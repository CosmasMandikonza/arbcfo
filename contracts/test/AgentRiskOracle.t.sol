// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { AgentRiskOracle } from "../src/AgentRiskOracle.sol";
import { SolidityRiskEngine } from "../src/SolidityRiskEngine.sol";
import { ITransactionRiskOracle } from "../src/ITransactionRiskOracle.sol";

contract AgentRiskOracleTest is Test {
    AgentRiskOracle public oracle;
    SolidityRiskEngine public riskEngine;

    address admin = makeAddr("admin");
    address vault = makeAddr("vault");
    address initiator = makeAddr("initiator");

    address recipient1 = makeAddr("recipient1");
    address recipient2 = makeAddr("recipient2");
    address recipient3 = makeAddr("recipient3");
    address recipient4 = makeAddr("recipient4");

    address usdc = makeAddr("usdc");
    address rwaToken = makeAddr("rwaToken");

    function setUp() public {
        riskEngine = new SolidityRiskEngine(admin);

        oracle = new AgentRiskOracle(admin, address(riskEngine), address(0), address(0));

        vm.prank(admin);
        oracle.authorizeCaller(vault);
    }

    // ═══════════════════════════════════════
    // ACCESS CONTROL
    // ═══════════════════════════════════════

    function test_unauthorizedCaller_reverts() public {
        address nobody = makeAddr("nobody");

        vm.prank(nobody);
        vm.expectRevert(AgentRiskOracle.NotAuthorizedCaller.selector);
        oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
    }

    function test_authorizedCaller_succeeds() public {
        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);

        assertLe(score, 100);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_previewRisk_anyoneCanCall() public {
        address nobody = makeAddr("nobody");

        vm.prank(nobody);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision) =
            oracle.previewRisk(initiator, recipient1, usdc, 1_000e6);

        assertLe(score, 100);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_revokeAccess() public {
        vm.prank(admin);
        oracle.revokeCaller(vault);

        vm.prank(vault);
        vm.expectRevert(AgentRiskOracle.NotAuthorizedCaller.selector);
        oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
    }

    // ═══════════════════════════════════════
    // BASIC SCORING
    // ═══════════════════════════════════════

    function test_firstPayment_lowRisk_safe() public {
        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);

        assertLt(score, 10);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_establishedRecipient_veryLowRisk() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(vault);
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
        }

        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);

        assertLe(score, 5);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_anomalousSpike_blocks_viaStylusSignal() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(vault);
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
        }

        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 50_000e6);

        console2.log("Spike score:", score);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.BLOCK));
        assertGt(score, 20);
    }

    // ═══════════════════════════════════════
    // TOKEN-AWARE CORRELATION
    // ═══════════════════════════════════════

    function test_tokenAware_splitAttack_blocks() public {
        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, rwaToken, 15_000e6);

        vm.prank(vault);
        oracle.assessRisk(initiator, recipient2, rwaToken, 15_000e6);

        vm.prank(vault);
        oracle.assessRisk(initiator, recipient3, rwaToken, 15_000e6);

        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient4, rwaToken, 15_000e6);

        console2.log("Correlation score:", score);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.BLOCK));
        assertGe(score, 55);
    }

    function test_smallDiversifiedFlow_staysSafe() public {
        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, usdc, 2_000e6);

        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient2, usdc, 3_000e6);

        assertLt(score, 20);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_trustedRecipient_hasNoNewRecipientCorrelation() public {
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(vault);
            oracle.assessRisk(initiator, recipient1, usdc, 5_000e6);
        }

        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 5_000e6);

        assertLe(score, 5);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    // ═══════════════════════════════════════
    // RECIPIENT TX COUNT
    // ═══════════════════════════════════════

    function test_recipientTxCount_onlyIncrements_forSafeActions() public {
        assertEq(oracle.getRecipientTxCount(recipient1), 0);

        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
        assertEq(oracle.getRecipientTxCount(recipient1), 1);

        for (uint256 i = 0; i < 4; i++) {
            vm.prank(vault);
            oracle.assessRisk(initiator, recipient1, usdc, 1_000e6);
        }

        uint256 beforeBlocked = oracle.getRecipientTxCount(recipient1);

        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, usdc, 80_000e6);

        uint256 afterBlocked = oracle.getRecipientTxCount(recipient1);
        assertEq(afterBlocked, beforeBlocked);
    }

    function test_recipientTxCount_notManipulableByUnauthorizedCaller() public {
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(AgentRiskOracle.NotAuthorizedCaller.selector);
        oracle.assessRisk(attacker, recipient1, usdc, 1);

        assertEq(oracle.getRecipientTxCount(recipient1), 0);
    }

    // ═══════════════════════════════════════
    // EPOCH VIEWS
    // ═══════════════════════════════════════

    function test_epochCorrelationView() public {
        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, usdc, 10_000e6);

        (
            uint256 epoch,
            uint256 totalSpend,
            uint256 distinctRecipients,
            uint256 spendPct,
            uint256 recipientPct
        ) = oracle.getEpochCorrelation();

        assertEq(epoch, block.timestamp / 1 days);
        assertEq(totalSpend, 10_000e6);
        assertEq(distinctRecipients, 1);
        assertEq(spendPct, 20);
        assertEq(recipientPct, 20);
    }

    function test_tokenEpochCorrelationView() public {
        vm.prank(vault);
        oracle.assessRisk(initiator, recipient1, rwaToken, 10_000e6);

        (
            uint256 epoch,
            uint256 totalSpend,
            uint256 distinctRecipients,
            uint256 spendPct,
            uint256 recipientPct
        ) = oracle.getTokenEpochCorrelation(rwaToken);

        assertEq(epoch, block.timestamp / 1 days);
        assertEq(totalSpend, 10_000e6);
        assertEq(distinctRecipients, 1);
        assertEq(spendPct, 40); // 10k / 25k
        assertEq(recipientPct, 33); // 1 / 3 rounded down
    }

    // ═══════════════════════════════════════
    // EDGE CASES
    // ═══════════════════════════════════════

    function test_zeroAmount_lowRisk() public {
        vm.prank(vault);
        (uint256 score, ITransactionRiskOracle.OracleDecision decision,) =
            oracle.assessRisk(initiator, recipient1, usdc, 0);

        assertLe(score, 10);
        assertEq(uint8(decision), uint8(ITransactionRiskOracle.OracleDecision.SAFE));
    }

    function test_constructorZeroAdmin_reverts() public {
        vm.expectRevert(AgentRiskOracle.ZeroAddress.selector);
        new AgentRiskOracle(address(0), address(riskEngine), address(0), address(0));
    }
}
