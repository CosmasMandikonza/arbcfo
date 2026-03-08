// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IRiskEngine } from "./IRiskEngine.sol";
import { ITransactionRiskOracle } from "./ITransactionRiskOracle.sol";

/// @title AgentRiskOracle
/// @notice Composite transaction risk oracle for onchain financial actions.
/// @dev The contract name is preserved for compatibility, but the semantics are:
///      initiator + recipient + token + amount.
///      State-changing assessments are access-controlled to prevent score poisoning.
///      Read-only previews are permissionless.
///
/// Signals combined:
///   1. Stylus / Solidity anomaly detection
///   2. Initiator identity / reputation signal
///   3. Global new-recipient correlation
///   4. Token-specific new-recipient concentration
contract AgentRiskOracle is ITransactionRiskOracle {
    // ─── Access Control ───
    address public admin;
    mapping(address => bool) public authorizedCallers;

    // ─── External Registries / Engines ───
    IRiskEngine public immutable stylusRiskEngine;
    address public immutable identityRegistry;
    address public immutable reputationRegistry;

    // ─── Reentrancy Guard ───
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "ReentrancyGuard: reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ─── Correlation State ───
    struct EpochCorrelation {
        uint256 totalNewRecipientSpend;
        uint256 distinctNewRecipients;
        mapping(address => bool) seenRecipient;
    }

    struct TokenEpochCorrelation {
        uint256 totalNewRecipientSpend;
        uint256 distinctNewRecipients;
        mapping(address => bool) seenRecipient;
    }

    mapping(uint256 => EpochCorrelation) internal epochs;
    mapping(uint256 => mapping(address => TokenEpochCorrelation)) internal tokenEpochs;
    mapping(address => uint256) public recipientTxCount;

    // ─── Configuration ───
    uint256 public constant NEW_RECIPIENT_THRESHOLD = 3;
    uint256 public constant EPOCH_DURATION = 1 days;

    uint256 public constant MAX_NEW_RECIPIENT_DAILY_SPEND = 50_000e6;
    uint256 public constant MAX_NEW_RECIPIENTS_PER_EPOCH = 5;

    uint256 public constant MAX_NEW_RECIPIENT_TOKEN_DAILY_SPEND = 25_000e6;
    uint256 public constant MAX_NEW_RECIPIENTS_PER_TOKEN_EPOCH = 3;

    uint256 public constant STYLUS_WEIGHT = 30;
    uint256 public constant IDENTITY_WEIGHT = 15;
    uint256 public constant GLOBAL_CORRELATION_WEIGHT = 35;
    uint256 public constant TOKEN_CORRELATION_WEIGHT = 25;
    uint256 public constant MAX_COMPOUND_BONUS = 15;

    uint256 public constant REVIEW_THRESHOLD = 45;
    uint256 public constant BLOCK_THRESHOLD = 80;
    uint256 public constant CORRELATION_BLOCK_THRESHOLD = 55;

    // ─── Events ───
    event RiskAssessed(
        address indexed initiator,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 compositeScore,
        OracleDecision decision,
        uint256 stylusScore,
        uint256 initiatorScore,
        uint256 correlationScore
    );

    event CorrelationAlert(
        uint256 indexed epoch,
        address indexed token,
        uint256 totalNewRecipientSpend,
        uint256 distinctNewRecipients,
        address triggeredBy
    );

    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // ─── Errors ───
    error NotAdmin();
    error NotAuthorizedCaller();
    error ZeroAddress();

    // ─── Constructor ───
    constructor(
        address admin_,
        address stylusRiskEngine_,
        address identityRegistry_,
        address reputationRegistry_
    ) {
        if (admin_ == address(0)) revert ZeroAddress();

        admin = admin_;
        stylusRiskEngine = IRiskEngine(stylusRiskEngine_);
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;

        authorizedCallers[admin_] = true;
    }

    // ─── Admin ───

    function authorizeCaller(address caller) external {
        if (msg.sender != admin) revert NotAdmin();
        if (caller == address(0)) revert ZeroAddress();

        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    function revokeCaller(address caller) external {
        if (msg.sender != admin) revert NotAdmin();

        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }

    // ═══════════════════════════════════════════════════════════════════
    // MAIN 4-ARG API
    // ═══════════════════════════════════════════════════════════════════

    function assessRisk(address initiator, address recipient, address token, uint256 amount)
        external
        override
        nonReentrant
        returns (uint256 compositeScore, OracleDecision decision, bytes memory breakdown)
    {
        if (!authorizedCallers[msg.sender]) revert NotAuthorizedCaller();
        return _assessRisk(initiator, recipient, token, amount);
    }

    function previewRisk(address initiator, address recipient, address token, uint256 amount)
        external
        view
        override
        returns (uint256 compositeScore, OracleDecision decision)
    {
        return _previewRisk(initiator, recipient, token, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    // BACKWARD-COMPAT 3-ARG API
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Backward-compatible wrapper:
    ///         assessRisk(initiator, recipient, amount) -> token assumed unknown.
    function assessRisk(address initiator, address recipient, uint256 amount)
        external
        nonReentrant
        returns (uint256 compositeScore, bool blocked, bytes memory breakdown)
    {
        if (!authorizedCallers[msg.sender]) revert NotAuthorizedCaller();

        OracleDecision decision;
        (compositeScore, decision, breakdown) =
            _assessRisk(initiator, recipient, address(0), amount);

        blocked = decision == OracleDecision.BLOCK;
    }

    /// @notice Backward-compatible wrapper:
    ///         previewRisk(initiator, recipient, amount) -> token assumed unknown.
    function previewRisk(address initiator, address recipient, uint256 amount)
        external
        view
        returns (uint256 compositeScore, bool wouldBlock)
    {
        OracleDecision decision;
        (compositeScore, decision) = _previewRisk(initiator, recipient, address(0), amount);

        wouldBlock = decision == OracleDecision.BLOCK;
    }

    // ═══════════════════════════════════════════════════════════════════
    // INTERNAL: STATEFUL ASSESSMENT
    // ═══════════════════════════════════════════════════════════════════

    function _assessRisk(address initiator, address recipient, address token, uint256 amount)
        internal
        returns (uint256 compositeScore, OracleDecision decision, bytes memory breakdown)
    {
        (uint256 stylusScore, bool stylusSafe, uint256 zScore) =
            _assessStylusRisk(recipient, amount);

        uint256 initiatorScore = _assessInitiatorIdentity(initiator);
        uint256 correlationScore = _assessCorrelation(recipient, token, amount);
        uint256 compoundBonus = _computeCompoundBonus(initiatorScore, correlationScore);

        compositeScore = stylusScore + initiatorScore + correlationScore + compoundBonus;
        if (compositeScore > 100) {
            compositeScore = 100;
        }

        decision = _deriveDecision(stylusSafe, compositeScore, correlationScore);

        if (decision == OracleDecision.SAFE) {
            recipientTxCount[recipient] += 1;
        }

        breakdown = abi.encode(stylusScore, initiatorScore, correlationScore, compoundBonus, zScore);

        emit RiskAssessed(
            initiator,
            recipient,
            token,
            amount,
            compositeScore,
            decision,
            stylusScore,
            initiatorScore,
            correlationScore
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // INTERNAL: READ-ONLY PREVIEW
    // ═══════════════════════════════════════════════════════════════════

    function _previewRisk(address initiator, address recipient, address token, uint256 amount)
        internal
        view
        returns (uint256 compositeScore, OracleDecision decision)
    {
        (uint256 stylusScore, bool stylusSafe,) = _previewStylusRisk(recipient, amount);
        uint256 initiatorScore = _assessInitiatorIdentity(initiator);
        uint256 correlationScore = _previewCorrelation(recipient, token, amount);
        uint256 compoundBonus = _computeCompoundBonus(initiatorScore, correlationScore);

        compositeScore = stylusScore + initiatorScore + correlationScore + compoundBonus;
        if (compositeScore > 100) {
            compositeScore = 100;
        }

        decision = _deriveDecision(stylusSafe, compositeScore, correlationScore);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SIGNAL 1: STYLUS / SOLIDITY ANOMALY ENGINE
    // ═══════════════════════════════════════════════════════════════════

    function _assessStylusRisk(address recipient, uint256 amount)
        internal
        returns (uint256 stylusScore, bool stylusSafe, uint256 zScore)
    {
        stylusSafe = true;
        zScore = 0;
        stylusScore = 0;

        if (address(stylusRiskEngine) == address(0)) {
            return (0, true, 0);
        }

        try stylusRiskEngine.evaluateRisk(recipient, amount) returns (bool isSafe, uint256 z) {
            stylusSafe = isSafe;
            zScore = z;

            if (z > 1e18) {
                stylusScore = ((z - 1e18) * STYLUS_WEIGHT) / (2e18);
                if (stylusScore > STYLUS_WEIGHT) {
                    stylusScore = STYLUS_WEIGHT;
                }
            }
        } catch {
            // Fails safe into review/blocking logic later if other signals are elevated.
            // We do not hard-block solely on oracle sub-call failure.
            stylusSafe = true;
            stylusScore = STYLUS_WEIGHT / 2;
            zScore = 0;
        }
    }

    function _previewStylusRisk(address recipient, uint256 amount)
        internal
        view
        returns (uint256 stylusScore, bool stylusSafe, uint256 zEst)
    {
        stylusSafe = true;
        stylusScore = 0;
        zEst = 0;

        if (address(stylusRiskEngine) == address(0)) {
            return (0, true, 0);
        }

        uint256 txCount;
        try stylusRiskEngine.getVendorTxCount(recipient) returns (uint256 count) {
            txCount = count;
        } catch {
            return (STYLUS_WEIGHT / 2, true, 0);
        }

        if (txCount < 3) {
            return (0, true, 0);
        }

        try stylusRiskEngine.getVendorEma(recipient) returns (uint256 ema) {
            uint256 variance = stylusRiskEngine.getVendorVariance(recipient);
            uint256 amountFp = (amount * 1e18) / 1e6;
            uint256 deviation = amountFp > ema ? amountFp - ema : ema - amountFp;
            uint256 mad = _sqrt(variance);

            if (mad > 0) {
                zEst = (deviation * 1e18) / mad;

                if (zEst > 3e18) {
                    stylusSafe = false;
                    stylusScore = STYLUS_WEIGHT;
                } else if (zEst > 1e18) {
                    stylusScore = ((zEst - 1e18) * STYLUS_WEIGHT) / (2e18);
                    if (stylusScore > STYLUS_WEIGHT) {
                        stylusScore = STYLUS_WEIGHT;
                    }
                }
            }
        } catch {
            stylusSafe = true;
            stylusScore = STYLUS_WEIGHT / 2;
            zEst = 0;
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SIGNAL 2: INITIATOR IDENTITY / REPUTATION
    // ═══════════════════════════════════════════════════════════════════

    function _assessInitiatorIdentity(address initiator) internal view returns (uint256) {
        if (identityRegistry == address(0)) {
            return 0;
        }

        uint256 balance;
        try IERC721Minimal(identityRegistry).balanceOf(initiator) returns (uint256 b) {
            balance = b;
        } catch {
            return IDENTITY_WEIGHT / 2;
        }

        if (balance == 0) {
            return IDENTITY_WEIGHT;
        }

        if (reputationRegistry != address(0)) {
            (bool success, bytes memory data) = reputationRegistry.staticcall(
                abi.encodeWithSignature(
                    "readAllFeedback(uint256,uint256,uint256)",
                    uint256(uint160(initiator)),
                    uint256(0),
                    uint256(1)
                )
            );

            if (success && data.length > 64) {
                return 2;
            }

            return IDENTITY_WEIGHT / 3;
        }

        return IDENTITY_WEIGHT / 3;
    }

    // ═══════════════════════════════════════════════════════════════════
    // SIGNAL 3 + 4: GLOBAL + TOKEN-AWARE CORRELATION
    // ═══════════════════════════════════════════════════════════════════

    function _assessCorrelation(address recipient, address token, uint256 amount)
        internal
        returns (uint256 score)
    {
        if (recipientTxCount[recipient] >= NEW_RECIPIENT_THRESHOLD) {
            return 0;
        }

        uint256 epoch = block.timestamp / EPOCH_DURATION;

        EpochCorrelation storage globalEpoch = epochs[epoch];
        globalEpoch.totalNewRecipientSpend += amount;
        if (!globalEpoch.seenRecipient[recipient]) {
            globalEpoch.seenRecipient[recipient] = true;
            globalEpoch.distinctNewRecipients += 1;
        }

        uint256 tokenSpend = 0;
        uint256 tokenRecipients = 0;

        if (token != address(0)) {
            TokenEpochCorrelation storage tokenEpoch = tokenEpochs[epoch][token];
            tokenEpoch.totalNewRecipientSpend += amount;
            if (!tokenEpoch.seenRecipient[recipient]) {
                tokenEpoch.seenRecipient[recipient] = true;
                tokenEpoch.distinctNewRecipients += 1;
            }

            tokenSpend = tokenEpoch.totalNewRecipientSpend;
            tokenRecipients = tokenEpoch.distinctNewRecipients;
        }

        score = _computeCorrelationScore(
            globalEpoch.totalNewRecipientSpend,
            globalEpoch.distinctNewRecipients,
            tokenSpend,
            tokenRecipients
        );

        if (score >= CORRELATION_BLOCK_THRESHOLD / 2) {
            emit CorrelationAlert(
                epoch,
                token,
                globalEpoch.totalNewRecipientSpend,
                globalEpoch.distinctNewRecipients,
                recipient
            );
        }
    }

    function _previewCorrelation(address recipient, address token, uint256 amount)
        internal
        view
        returns (uint256)
    {
        if (recipientTxCount[recipient] >= NEW_RECIPIENT_THRESHOLD) {
            return 0;
        }

        uint256 epoch = block.timestamp / EPOCH_DURATION;

        EpochCorrelation storage globalEpoch = epochs[epoch];
        uint256 projectedGlobalSpend = globalEpoch.totalNewRecipientSpend + amount;
        uint256 projectedGlobalRecipients = globalEpoch.distinctNewRecipients;
        if (!globalEpoch.seenRecipient[recipient]) {
            projectedGlobalRecipients += 1;
        }

        uint256 projectedTokenSpend = 0;
        uint256 projectedTokenRecipients = 0;

        if (token != address(0)) {
            TokenEpochCorrelation storage tokenEpoch = tokenEpochs[epoch][token];
            projectedTokenSpend = tokenEpoch.totalNewRecipientSpend + amount;
            projectedTokenRecipients = tokenEpoch.distinctNewRecipients;
            if (!tokenEpoch.seenRecipient[recipient]) {
                projectedTokenRecipients += 1;
            }
        }

        return _computeCorrelationScore(
            projectedGlobalSpend,
            projectedGlobalRecipients,
            projectedTokenSpend,
            projectedTokenRecipients
        );
    }

    function _computeCorrelationScore(
        uint256 globalSpend,
        uint256 globalRecipients,
        uint256 tokenSpend,
        uint256 tokenRecipients
    ) internal pure returns (uint256) {
        uint256 globalSpendRatio =
            (globalSpend * 100) / MAX_NEW_RECIPIENT_DAILY_SPEND;
        if (globalSpendRatio > 100) globalSpendRatio = 100;

        uint256 globalRecipientRatio = (globalRecipients * 100) / MAX_NEW_RECIPIENTS_PER_EPOCH;
        if (globalRecipientRatio > 100) globalRecipientRatio = 100;

        uint256 globalDominant =
            globalSpendRatio > globalRecipientRatio ? globalSpendRatio : globalRecipientRatio;

        uint256 globalScore = (globalDominant * globalDominant * GLOBAL_CORRELATION_WEIGHT) / 10000;

        uint256 tokenScore = 0;
        if (tokenSpend > 0 || tokenRecipients > 0) {
            uint256 tokenSpendRatio = (tokenSpend * 100) / MAX_NEW_RECIPIENT_TOKEN_DAILY_SPEND;
            if (tokenSpendRatio > 100) tokenSpendRatio = 100;

            uint256 tokenRecipientRatio =
                (tokenRecipients * 100) / MAX_NEW_RECIPIENTS_PER_TOKEN_EPOCH;
            if (tokenRecipientRatio > 100) tokenRecipientRatio = 100;

            uint256 tokenDominant =
                tokenSpendRatio > tokenRecipientRatio ? tokenSpendRatio : tokenRecipientRatio;

            tokenScore = (tokenDominant * tokenDominant * TOKEN_CORRELATION_WEIGHT) / 10000;
        }

        return globalScore + tokenScore;
    }

    // ═══════════════════════════════════════════════════════════════════
    // DECISIONING
    // ═══════════════════════════════════════════════════════════════════

    function _deriveDecision(bool stylusSafe, uint256 compositeScore, uint256 correlationScore)
        internal
        pure
        returns (OracleDecision)
    {
        if (!stylusSafe) {
            return OracleDecision.BLOCK;
        }

        if (correlationScore >= CORRELATION_BLOCK_THRESHOLD) {
            return OracleDecision.BLOCK;
        }

        if (compositeScore >= BLOCK_THRESHOLD) {
            return OracleDecision.BLOCK;
        }

        if (compositeScore >= REVIEW_THRESHOLD) {
            return OracleDecision.REVIEW;
        }

        return OracleDecision.SAFE;
    }

    function _computeCompoundBonus(uint256 initiatorScore, uint256 correlationScore)
        internal
        pure
        returns (uint256)
    {
        if (initiatorScore == 0 || correlationScore == 0) {
            return 0;
        }

        uint256 bonus = (initiatorScore * correlationScore) / 30;
        if (bonus > MAX_COMPOUND_BONUS) {
            return MAX_COMPOUND_BONUS;
        }

        return bonus;
    }

    // ═══════════════════════════════════════════════════════════════════
    // VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function getEpochCorrelation()
        external
        view
        returns (
            uint256 epoch,
            uint256 totalNewRecipientSpend,
            uint256 distinctNewRecipients,
            uint256 spendCapPct,
            uint256 recipientCapPct
        )
    {
        epoch = block.timestamp / EPOCH_DURATION;
        EpochCorrelation storage ec = epochs[epoch];

        totalNewRecipientSpend = ec.totalNewRecipientSpend;
        distinctNewRecipients = ec.distinctNewRecipients;
        spendCapPct = (totalNewRecipientSpend * 100) / MAX_NEW_RECIPIENT_DAILY_SPEND;
        recipientCapPct = (distinctNewRecipients * 100) / MAX_NEW_RECIPIENTS_PER_EPOCH;
    }

    function getTokenEpochCorrelation(address token)
        external
        view
        returns (
            uint256 epoch,
            uint256 totalNewRecipientSpend,
            uint256 distinctNewRecipients,
            uint256 spendCapPct,
            uint256 recipientCapPct
        )
    {
        epoch = block.timestamp / EPOCH_DURATION;
        TokenEpochCorrelation storage ec = tokenEpochs[epoch][token];

        totalNewRecipientSpend = ec.totalNewRecipientSpend;
        distinctNewRecipients = ec.distinctNewRecipients;
        spendCapPct = MAX_NEW_RECIPIENT_TOKEN_DAILY_SPEND == 0
            ? 0
            : (totalNewRecipientSpend * 100) / MAX_NEW_RECIPIENT_TOKEN_DAILY_SPEND;
        recipientCapPct = MAX_NEW_RECIPIENTS_PER_TOKEN_EPOCH == 0
            ? 0
            : (distinctNewRecipients * 100) / MAX_NEW_RECIPIENTS_PER_TOKEN_EPOCH;
    }

    function hasInitiatorIdentity(address initiator) external view returns (bool) {
        if (identityRegistry == address(0)) {
            return false;
        }

        try IERC721Minimal(identityRegistry).balanceOf(initiator) returns (uint256 b) {
            return b > 0;
        } catch {
            return false;
        }
    }

    /// @notice Backward-compatible alias.
    function hasAgentIdentity(address initiator) external view returns (bool) {
        if (identityRegistry == address(0)) {
            return false;
        }

        try IERC721Minimal(identityRegistry).balanceOf(initiator) returns (uint256 b) {
            return b > 0;
        } catch {
            return false;
        }
    }

    function getRecipientTxCount(address recipient) external view returns (uint256) {
        return recipientTxCount[recipient];
    }

    /// @notice Backward-compatible alias.
    function getVendorTxCount(address recipient) external view returns (uint256) {
        return recipientTxCount[recipient];
    }

    // ─── Math ───

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        uint256 y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }

        return y;
    }
}

interface IERC721Minimal {
    function balanceOf(address owner) external view returns (uint256);
}
