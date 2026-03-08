// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { ReceiptRegistry } from "../src/ReceiptRegistry.sol";
import { ArbCFOVault } from "../src/ArbCFOVault.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { IArbCFOTypes } from "../src/IArbCFOTypes.sol";
import { ITransactionRiskOracle } from "../src/ITransactionRiskOracle.sol";

contract MockTransactionRiskOracle is ITransactionRiskOracle {
    struct Assessment {
        uint256 score;
        OracleDecision decision;
        bytes breakdown;
        bool configured;
    }

    Assessment internal nextAssessment;

    function setNextAssessment(uint256 score, OracleDecision decision, bytes calldata breakdown)
        external
    {
        nextAssessment = Assessment({
            score: score, decision: decision, breakdown: breakdown, configured: true
        });
    }

    function assessRisk(address, address, address, uint256)
        external
        override
        returns (uint256 compositeScore, OracleDecision decision, bytes memory breakdown)
    {
        if (!nextAssessment.configured) {
            return (
                8,
                OracleDecision.SAFE,
                abi.encode(uint256(0), uint256(0), uint256(0), uint256(0), uint256(0))
            );
        }

        compositeScore = nextAssessment.score;
        decision = nextAssessment.decision;
        breakdown = nextAssessment.breakdown;

        delete nextAssessment;
    }

    function previewRisk(address, address, address, uint256)
        external
        view
        override
        returns (uint256 compositeScore, OracleDecision decision)
    {
        if (!nextAssessment.configured) {
            return (8, OracleDecision.SAFE);
        }

        return (nextAssessment.score, nextAssessment.decision);
    }
}

contract ArbCFOTest is Test, IArbCFOTypes {
    PolicyEngine public policy;
    ReceiptRegistry public registry;
    ArbCFOVault public vault;
    MockUSDC public usdc;
    MockTransactionRiskOracle public oracle;

    address admin = makeAddr("admin");
    address operator = makeAddr("operator");
    address vendor = makeAddr("vendor");
    address nobody = makeAddr("nobody");

    address approver1;
    uint256 approver1Key;
    address approver2;
    uint256 approver2Key;

    bytes32 constant INVOICE_HASH = keccak256("INV-001");
    bytes32 constant MEMO_HASH = keccak256("Test payment");

    function setUp() public {
        (approver1, approver1Key) = makeAddrAndKey("approver1");
        (approver2, approver2Key) = makeAddrAndKey("approver2");

        vm.startPrank(admin);

        usdc = new MockUSDC();
        policy = new PolicyEngine(admin, 100_000e6);
        registry = new ReceiptRegistry(admin);
        oracle = new MockTransactionRiskOracle();

        vault = new ArbCFOVault(admin, address(policy), address(registry), address(oracle), 2);

        policy.grantRole(policy.VAULT_ROLE(), address(vault));
        registry.grantRole(registry.VAULT_ROLE(), address(vault));
        vault.grantRole(vault.APPROVER_ROLE(), approver1);
        vault.grantRole(vault.APPROVER_ROLE(), approver2);
        vault.grantRole(vault.OPERATOR_ROLE(), operator);

        policy.setTokenAllowed(address(usdc), true);
        policy.setCategoryBudget(0, 50_000e6);

        usdc.mint(admin, 1_000_000e6);
        usdc.approve(address(vault), 500_000e6);
        vault.deposit(address(usdc), 500_000e6);

        vm.stopPrank();
    }

    function test_deposit() public {
        vm.startPrank(admin);
        usdc.approve(address(vault), 100e6);
        vault.deposit(address(usdc), 100e6);
        assertEq(vault.getBalance(address(usdc)), 500_100e6);
        vm.stopPrank();
    }

    function test_withdraw_admin() public {
        vm.prank(admin);
        vault.withdraw(address(usdc), admin, 1_000e6);
        assertEq(vault.getBalance(address(usdc)), 499_000e6);
    }

    function test_createIntent_operator() public {
        vm.prank(operator);
        uint256 id = vault.createIntent(
            vendor, address(usdc), 1_000e6, 0, INVOICE_HASH, MEMO_HASH, block.timestamp + 7 days
        );

        assertEq(id, 1);

        PaymentIntent memory intent = vault.getIntent(1);
        assertEq(intent.vendor, vendor);
        assertEq(intent.amount, 1_000e6);
        assertEq(uint8(intent.status), uint8(IntentStatus.AwaitingApprovals));
    }

    function test_duplicateInvoiceHash_reverts() public {
        vm.startPrank(operator);
        vault.createIntent(
            vendor, address(usdc), 1_000e6, 0, INVOICE_HASH, MEMO_HASH, block.timestamp + 7 days
        );

        vm.expectRevert(abi.encodeWithSelector(DuplicateIntent.selector, INVOICE_HASH));
        vault.createIntent(
            vendor, address(usdc), 500e6, 0, INVOICE_HASH, MEMO_HASH, block.timestamp + 7 days
        );
        vm.stopPrank();
    }

    function test_execute_safe_withSignatures() public {
        _createTestIntent();

        uint256 vendorBefore = usdc.balanceOf(vendor);
        _executeIntentById(1);

        PaymentIntent memory intent = vault.getIntent(1);
        assertEq(uint8(intent.status), uint8(IntentStatus.Executed));
        assertEq(usdc.balanceOf(vendor), vendorBefore + 1_000e6);

        bytes32 receiptId =
            keccak256(abi.encode(uint256(1), INVOICE_HASH, vendor, uint256(1_000e6)));
        ReceiptRegistry.ReceiptData memory receipt = registry.getReceipt(receiptId);
        assertTrue(receipt.exists);
    }

    function test_execute_review_routesToPendingRiskReview() public {
        _createTestIntent();

        oracle.setNextAssessment(
            62,
            ITransactionRiskOracle.OracleDecision.REVIEW,
            abi.encode(uint256(8), uint256(6), uint256(40), uint256(8), uint256(0))
        );

        uint256 vendorBefore = usdc.balanceOf(vendor);
        _executeIntentById(1);

        PaymentIntent memory intent = vault.getIntent(1);
        assertEq(uint8(intent.status), uint8(IntentStatus.PendingRiskReview));
        assertEq(usdc.balanceOf(vendor), vendorBefore);
    }

    function test_execute_block_routesToRejected() public {
        _createTestIntent();

        oracle.setNextAssessment(
            91,
            ITransactionRiskOracle.OracleDecision.BLOCK,
            abi.encode(uint256(30), uint256(10), uint256(45), uint256(6), uint256(0))
        );

        uint256 vendorBefore = usdc.balanceOf(vendor);
        _executeIntentById(1);

        PaymentIntent memory intent = vault.getIntent(1);
        assertEq(uint8(intent.status), uint8(IntentStatus.Rejected));
        assertEq(usdc.balanceOf(vendor), vendorBefore);
    }

    function test_policy_vendorAllowlist() public {
        vm.prank(admin);
        policy.setVendorAllowlistEnabled(true);

        _createTestIntent();

        (address[] memory approvers, bytes[] memory sigs) = _buildSignatures(1);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(VendorNotAllowed.selector, vendor));
        vault.executeIntent(1, approvers, sigs);

        vm.prank(admin);
        policy.setVendorAllowed(vendor, true);

        vm.prank(operator);
        vault.executeIntent(1, approvers, sigs);

        assertEq(uint8(vault.getIntent(1).status), uint8(IntentStatus.Executed));
    }

    function test_policy_maxPerInvoice() public {
        vm.prank(operator);
        uint256 id = vault.createIntent(
            vendor,
            address(usdc),
            200_000e6,
            0,
            keccak256("BIG-INV"),
            MEMO_HASH,
            block.timestamp + 7 days
        );

        (address[] memory approvers, bytes[] memory sigs) = _buildSignatures(id);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(MaxPerInvoiceExceeded.selector, 200_000e6, 100_000e6)
        );
        vault.executeIntent(id, approvers, sigs);
    }

    function test_policy_dailyLimit() public {
        vm.prank(operator);
        uint256 id1 = vault.createIntent(
            vendor,
            address(usdc),
            45_000e6,
            0,
            keccak256("INV-A"),
            MEMO_HASH,
            block.timestamp + 7 days
        );
        _executeIntentById(id1);

        vm.prank(operator);
        uint256 id2 = vault.createIntent(
            vendor,
            address(usdc),
            10_000e6,
            0,
            keccak256("INV-B"),
            MEMO_HASH,
            block.timestamp + 7 days
        );

        (address[] memory approvers, bytes[] memory sigs) = _buildSignatures(id2);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(DailyLimitExceeded.selector, 0, 55_000e6, 50_000e6));
        vault.executeIntent(id2, approvers, sigs);
    }

    function test_policy_tokenNotAllowed() public {
        MockUSDC fakeToken = new MockUSDC();

        vm.prank(operator);
        uint256 id = vault.createIntent(
            vendor,
            address(fakeToken),
            1_000e6,
            0,
            keccak256("FAKE"),
            MEMO_HASH,
            block.timestamp + 7 days
        );

        (address[] memory approvers, bytes[] memory sigs) = _buildSignatures(id);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(TokenNotAllowed.selector, address(fakeToken)));
        vault.executeIntent(id, approvers, sigs);
    }

    function test_pause_blocksCreation() public {
        vm.prank(admin);
        vault.pause();

        vm.prank(operator);
        vm.expectRevert();
        vault.createIntent(
            vendor, address(usdc), 1_000e6, 0, INVOICE_HASH, MEMO_HASH, block.timestamp + 7 days
        );
    }

    function test_reject_intent() public {
        _createTestIntent();

        vm.prank(approver1);
        vault.rejectIntent(1);

        assertEq(uint8(vault.getIntent(1).status), uint8(IntentStatus.Rejected));
    }

    function test_cancel_byCreator() public {
        _createTestIntent();

        vm.prank(operator);
        vault.cancelIntent(1);

        assertEq(uint8(vault.getIntent(1).status), uint8(IntentStatus.Cancelled));
    }

    function _createTestIntent() internal {
        vm.prank(operator);
        vault.createIntent(
            vendor, address(usdc), 1_000e6, 0, INVOICE_HASH, MEMO_HASH, block.timestamp + 7 days
        );
    }

    function _buildSignatures(uint256 id)
        internal
        view
        returns (address[] memory approvers, bytes[] memory sigs)
    {
        approvers = new address[](2);
        sigs = new bytes[](2);

        approvers[0] = approver1;
        sigs[0] = _signApproval(approver1Key, id, vault.approverNonces(approver1));

        approvers[1] = approver2;
        sigs[1] = _signApproval(approver2Key, id, vault.approverNonces(approver2));
    }

    function _executeIntentById(uint256 id) internal {
        (address[] memory approvers, bytes[] memory sigs) = _buildSignatures(id);

        vm.prank(operator);
        vault.executeIntent(id, approvers, sigs);
    }

    function _signApproval(uint256 privateKey, uint256 intentId, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        PaymentIntent memory intent = vault.getIntent(intentId);

        bytes32 structHash = keccak256(
            abi.encode(
                vault.APPROVAL_TYPEHASH(),
                intentId,
                intent.vendor,
                intent.token,
                intent.amount,
                intent.invoiceHash,
                nonce
            )
        );

        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", vault.getDomainSeparator(), structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
