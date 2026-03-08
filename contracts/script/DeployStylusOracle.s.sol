// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRiskOracle } from "../src/AgentRiskOracle.sol";

/// @notice Deploy a second AgentRiskOracle pointing to the STYLUS WASM RiskEngine
///         This proves the oracle actually calls the Rust/WASM contract, not Solidity.
contract DeployStylusOracle is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // STYLUS WASM engine on Arbitrum Sepolia
        address stylusEngine = 0xE023B06B6e970308c15dE2bd85C269FC77aEf37a;

        // ERC-8004 registries (optional — pass zero to skip)
        address identityRegistry = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
        address reputationRegistry = address(0);

        console2.log("Deployer:", deployer);
        console2.log("Stylus Engine:", stylusEngine);

        vm.startBroadcast(deployerKey);

        AgentRiskOracle oracle =
            new AgentRiskOracle(deployer, stylusEngine, identityRegistry, reputationRegistry);

        console2.log("StylusOracle deployed:", address(oracle));

        vm.stopBroadcast();
    }
}
