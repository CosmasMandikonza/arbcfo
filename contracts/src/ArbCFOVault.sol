// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IArbCFOTypes } from "./IArbCFOTypes.sol";
import { ITransactionRiskOracle } from "./ITransactionRiskOracle.sol";
import { PolicyEngine } from "./PolicyEngine.sol";
import { ReceiptRegistry } from "./ReceiptRegistry.sol";

/// @title ArbCFOVault
/// @notice Treasury vault with multi-approval payment intents, onchain policies,
///         composite transaction-risk routing, and immutable receipts.
contract ArbCFOVault is AccessControl, ReentrancyGuard, Pausable, EIP712, IArbCFOTypes {
    using SafeERC20 for IERC20;

    // ─── Roles ───
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── EIP-712 TypeHash ───
    bytes32 public constant APPROVAL_TYPEHASH = keccak256(
        "ApprovePaymentIntent(uint256 intentId,address vendor,address token,uint256 amount,bytes32 invoiceHash,uint256 nonce)"
    );

    // ─── External contracts ───
    PolicyEngine public immutable policyEngine;
    ReceiptRegistry public immutable receiptRegistry;
    ITransactionRiskOracle public immutable riskOracle;

    // ─── Core state ───
    uint256 public nextIntentId = 1;
    uint256 public approvalThreshold = 1;

    mapping(uint256 => PaymentIntent) public intents;
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    mapping(bytes32 => bool) public invoiceHashUsed;
    mapping(address => uint256) public approverNonces;

    uint256[] public intentIds;

    // ─── Oracle assessment state ───
    mapping(uint256 => uint256) public riskScores;
    mapping(uint256 => uint8) public oracleDecisions;
    mapping(uint256 => bytes) internal oracleBreakdowns;

    // ─── Constructor ───
    constructor(
        address admin,
        address policyEngine_,
        address receiptRegistry_,
        address riskOracle_,
        uint256 threshold_
    ) EIP712("ArbCFOVault", "2") {
        if (admin == address(0)) revert ZeroAddress();
        if (policyEngine_ == address(0)) revert ZeroAddress();
        if (receiptRegistry_ == address(0)) revert ZeroAddress();
        if (threshold_ == 0) revert InvalidThreshold();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(APPROVER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        policyEngine = PolicyEngine(policyEngine_);
        receiptRegistry = ReceiptRegistry(receiptRegistry_);
        riskOracle = ITransactionRiskOracle(riskOracle_);
        approvalThreshold = threshold_;
    }

    // ─── Modifiers ───
    modifier intentExists(uint256 intentId) {
        if (intents[intentId].id == 0) revert IntentNotFound();
        _;
    }

    // ─── Vault: Deposit / Withdraw ───

    function deposit(address token, uint256 amount) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    function withdraw(address token, address to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal < amount) revert InsufficientFunds(bal, amount);

        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    // ─── Intent Lifecycle ───

    function createIntent(
        address vendor,
        address token,
        uint256 amount,
        uint256 categoryId,
        bytes32 invoiceHash,
        bytes32 memoHash,
        uint256 dueDate
    ) external whenNotPaused returns (uint256 intentId) {
        if (!hasRole(OPERATOR_ROLE, msg.sender) && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        if (vendor == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (invoiceHashUsed[invoiceHash]) revert DuplicateIntent(invoiceHash);

        intentId = nextIntentId++;

        intents[intentId] = PaymentIntent({
            id: intentId,
            creator: msg.sender,
            vendor: vendor,
            token: token,
            amount: amount,
            categoryId: categoryId,
            invoiceHash: invoiceHash,
            memoHash: memoHash,
            dueDate: dueDate,
            status: IntentStatus.AwaitingApprovals,
            approvalCount: 0,
            createdAt: block.timestamp,
            executedAt: 0
        });

        invoiceHashUsed[invoiceHash] = true;
        intentIds.push(intentId);

        emit IntentCreated(
            intentId, msg.sender, vendor, token, amount, categoryId, invoiceHash, memoHash, dueDate
        );
    }

    function approveIntent(uint256 intentId) external intentExists(intentId) whenNotPaused {
        if (!hasRole(APPROVER_ROLE, msg.sender)) revert NotAuthorized();

        PaymentIntent storage intent = intents[intentId];
        if (intent.status != IntentStatus.AwaitingApprovals) {
            revert InvalidStatus(intent.status, IntentStatus.AwaitingApprovals);
        }
        if (hasApproved[intentId][msg.sender]) revert AlreadyApproved();

        hasApproved[intentId][msg.sender] = true;
        intent.approvalCount += 1;

        emit IntentApproved(intentId, msg.sender, intent.approvalCount);
    }

    function executeIntent(
        uint256 intentId,
        address[] calldata approvers,
        bytes[] calldata signatures
    ) external intentExists(intentId) nonReentrant whenNotPaused {
        if (approvers.length != signatures.length) {
            revert SignatureArrayLengthMismatch();
        }

        PaymentIntent storage intent = intents[intentId];

        if (intent.status != IntentStatus.AwaitingApprovals) {
            revert InvalidStatus(intent.status, IntentStatus.AwaitingApprovals);
        }

        uint256 validSigs = intent.approvalCount;

        for (uint256 i = 0; i < approvers.length; i++) {
            address approver = approvers[i];

            if (!hasRole(APPROVER_ROLE, approver)) continue;
            if (hasApproved[intentId][approver]) continue;

            bytes32 structHash = keccak256(
                abi.encode(
                    APPROVAL_TYPEHASH,
                    intentId,
                    intent.vendor,
                    intent.token,
                    intent.amount,
                    intent.invoiceHash,
                    approverNonces[approver]
                )
            );

            bytes32 digest = _hashTypedDataV4(structHash);
            address recovered = ECDSA.recover(digest, signatures[i]);

            if (recovered != approver) revert InvalidSignature();

            hasApproved[intentId][approver] = true;
            approverNonces[approver] += 1;
            validSigs += 1;
        }

        if (validSigs < approvalThreshold) {
            revert ThresholdNotMet(validSigs, approvalThreshold);
        }

        intent.approvalCount = validSigs;

        // ── Policy check first ──
        policyEngine.validateIntent(intent.vendor, intent.token, intent.amount, intent.categoryId);

        // ── Composite oracle routing ──
        if (address(riskOracle) != address(0)) {
            try riskOracle.assessRisk(
                intent.creator, intent.vendor, intent.token, intent.amount
            ) returns (
                uint256 compositeScore,
                ITransactionRiskOracle.OracleDecision decision,
                bytes memory breakdown
            ) {
                riskScores[intentId] = compositeScore;
                oracleDecisions[intentId] = uint8(decision);
                oracleBreakdowns[intentId] = breakdown;

                if (decision == ITransactionRiskOracle.OracleDecision.REVIEW) {
                    intent.status = IntentStatus.PendingRiskReview;

                    emit RiskReviewRequired(
                        intentId,
                        intent.vendor,
                        intent.token,
                        intent.amount,
                        compositeScore,
                        uint8(decision)
                    );
                    return;
                }

                if (decision == ITransactionRiskOracle.OracleDecision.BLOCK) {
                    intent.status = IntentStatus.Rejected;

                    emit RiskBlocked(
                        intentId,
                        intent.vendor,
                        intent.token,
                        intent.amount,
                        compositeScore,
                        uint8(decision)
                    );
                    return;
                }

                emit RiskCheckPassed(intentId, intent.vendor, compositeScore);
            } catch {
                // Fail safe into review if the oracle call itself fails.
                riskScores[intentId] = 100;
                oracleDecisions[intentId] = uint8(ITransactionRiskOracle.OracleDecision.REVIEW);
                oracleBreakdowns[intentId] =
                    abi.encode(uint256(0), uint256(0), uint256(0), uint256(0), uint256(0));

                intent.status = IntentStatus.PendingRiskReview;

                emit RiskReviewRequired(
                    intentId,
                    intent.vendor,
                    intent.token,
                    intent.amount,
                    100,
                    uint8(ITransactionRiskOracle.OracleDecision.REVIEW)
                );
                return;
            }
        }

        // ── Funds check ──
        uint256 bal = IERC20(intent.token).balanceOf(address(this));
        if (bal < intent.amount) revert InsufficientFunds(bal, intent.amount);

        // ── Execute transfer ──
        intent.status = IntentStatus.Executed;
        intent.executedAt = block.timestamp;

        IERC20(intent.token).safeTransfer(intent.vendor, intent.amount);

        // ── Record spend ──
        policyEngine.recordSpend(intent.categoryId, intent.amount);

        // ── Mint receipt ──
        bytes32 receiptId =
            keccak256(abi.encode(intentId, intent.invoiceHash, intent.vendor, intent.amount));

        receiptRegistry.mintReceipt(
            receiptId,
            intentId,
            intent.vendor,
            intent.token,
            intent.amount,
            intent.categoryId,
            intent.invoiceHash,
            intent.memoHash
        );

        emit IntentExecuted(intentId, intent.vendor, intent.token, intent.amount, receiptId);

        emit PaymentReceipt(
            receiptId,
            intentId,
            intent.vendor,
            intent.token,
            intent.amount,
            intent.categoryId,
            intent.invoiceHash,
            intent.memoHash,
            block.timestamp
        );
    }

    function rejectIntent(uint256 intentId) external intentExists(intentId) whenNotPaused {
        if (!hasRole(APPROVER_ROLE, msg.sender) && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }

        PaymentIntent storage intent = intents[intentId];
        if (
            intent.status != IntentStatus.AwaitingApprovals
                && intent.status != IntentStatus.PendingRiskReview
                && intent.status != IntentStatus.Draft
        ) {
            revert InvalidStatus(intent.status, IntentStatus.AwaitingApprovals);
        }

        intent.status = IntentStatus.Rejected;
        emit IntentRejected(intentId, msg.sender);
    }

    function cancelIntent(uint256 intentId) external intentExists(intentId) {
        PaymentIntent storage intent = intents[intentId];

        if (msg.sender != intent.creator && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }

        if (intent.status == IntentStatus.Executed || intent.status == IntentStatus.Cancelled) {
            revert InvalidStatus(intent.status, IntentStatus.AwaitingApprovals);
        }

        intent.status = IntentStatus.Cancelled;
        emit IntentCancelled(intentId, msg.sender);
    }

    // ─── Admin ───

    function overrideRiskHold(uint256 intentId)
        external
        onlyRole(ADMIN_ROLE)
        intentExists(intentId)
    {
        PaymentIntent storage intent = intents[intentId];

        if (intent.status != IntentStatus.PendingRiskReview) {
            revert InvalidStatus(intent.status, IntentStatus.PendingRiskReview);
        }

        uint256 priorScore = riskScores[intentId];
        intent.status = IntentStatus.AwaitingApprovals;

        emit RiskOverrideApproved(intentId, msg.sender, priorScore);
    }

    function setApprovalThreshold(uint256 threshold_) external onlyRole(ADMIN_ROLE) {
        if (threshold_ == 0) revert InvalidThreshold();
        approvalThreshold = threshold_;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ─── Views ───

    function getIntent(uint256 intentId) external view returns (PaymentIntent memory) {
        if (intents[intentId].id == 0) revert IntentNotFound();
        return intents[intentId];
    }

    function getIntentCount() external view returns (uint256) {
        return intentIds.length;
    }

    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getRiskScore(uint256 intentId) external view returns (uint256) {
        return riskScores[intentId];
    }

    function getOracleAssessment(uint256 intentId)
        external
        view
        returns (uint256 score, uint8 decision, bytes memory breakdown)
    {
        score = riskScores[intentId];
        decision = oracleDecisions[intentId];
        breakdown = oracleBreakdowns[intentId];
    }

    function getRiskOracle() external view returns (address) {
        return address(riskOracle);
    }

    /// @notice Backward-compatible alias for older app code.
    function getRiskEngine() external view returns (address) {
        return address(riskOracle);
    }
}
