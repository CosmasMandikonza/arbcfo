// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { ReceiptRegistry } from "../src/ReceiptRegistry.sol";
import { ArbCFOVault } from "../src/ArbCFOVault.sol";
import { SolidityRiskEngine } from "../src/SolidityRiskEngine.sol";
import { AgentRiskOracle } from "../src/AgentRiskOracle.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address usdcAddress = vm.envOr("CONTRACT_USDC_ADDRESS", address(0));
        uint256 maxPerInvoice = vm.envOr("MAX_PER_INVOICE", uint256(100_000 * 1e6));
        uint256 threshold = vm.envOr("APPROVAL_THRESHOLD", uint256(1));

        address identityRegistry = vm.envOr(
            "ERC8004_IDENTITY_REGISTRY", address(0x8004A818BFB912233c491871b3d84c89A494BD9e)
        );

        address reputationRegistry = vm.envOr(
            "ERC8004_REPUTATION_REGISTRY", address(0x8004B663056A597Dffe9eCcC1965A193B7388713)
        );

        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        // ── Testnet USDC ──
        if (usdcAddress == address(0)) {
            MockUSDC usdc = new MockUSDC();
            usdcAddress = address(usdc);
            usdc.mint(deployer, 1_000_000 * 1e6);
            console2.log("MockUSDC:", usdcAddress);
        }

        // ── Policy Engine ──
        PolicyEngine policyEngine = new PolicyEngine(deployer, maxPerInvoice);
        console2.log("PolicyEngine:", address(policyEngine));

        // ── Receipt Registry ──
        ReceiptRegistry receiptRegistry = new ReceiptRegistry(deployer);
        console2.log("ReceiptRegistry:", address(receiptRegistry));

        // ── Anomaly Engine ──
        SolidityRiskEngine riskEngine = new SolidityRiskEngine(deployer);
        console2.log("SolidityRiskEngine:", address(riskEngine));

        // ── Composite Oracle ──
        AgentRiskOracle riskOracle = new AgentRiskOracle(
            deployer, address(riskEngine), identityRegistry, reputationRegistry
        );
        console2.log("AgentRiskOracle:", address(riskOracle));

        // ── Vault now points to the COMPOSITE ORACLE, not the raw engine ──
        ArbCFOVault vault = new ArbCFOVault(
            deployer,
            address(policyEngine),
            address(receiptRegistry),
            address(riskOracle),
            threshold
        );
        console2.log("Vault:", address(vault));

        // ── Authorize vault to perform stateful oracle assessments ──
        riskOracle.authorizeCaller(address(vault));

        // ── Wire roles ──
        policyEngine.grantRole(policyEngine.VAULT_ROLE(), address(vault));
        receiptRegistry.grantRole(receiptRegistry.VAULT_ROLE(), address(vault));

        // ── Seed policy configuration ──
        policyEngine.setTokenAllowed(usdcAddress, true);
        policyEngine.setCategoryBudget(0, 50_000 * 1e6);
        policyEngine.setCategoryBudget(1, 100_000 * 1e6);

        // ── Approve vault for funding ──
        MockUSDC(usdcAddress).approve(address(vault), type(uint256).max);

        console2.log("");
        console2.log("=== DEPLOYMENT COMPLETE ===");
        console2.log("Vault:              ", address(vault));
        console2.log("PolicyEngine:       ", address(policyEngine));
        console2.log("ReceiptRegistry:    ", address(receiptRegistry));
        console2.log("SolidityRiskEngine: ", address(riskEngine));
        console2.log("CompositeOracle:    ", address(riskOracle));
        console2.log("USDC:               ", usdcAddress);
        console2.log("IdentityRegistry:   ", identityRegistry);
        console2.log("ReputationRegistry: ", reputationRegistry);

        vm.stopBroadcast();
    }
}
