// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DhowEscrow} from "../src/DhowEscrow.sol";
import {DhowScoreRegistry} from "../src/DhowScoreRegistry.sol";

/// @notice Lean deploy that REUSES an already-deployed USDC + attestation
///         contract (set DHOW_USDC_ADDRESS / DHOW_EAS_ADDRESS) and only deploys
///         the escrow + score registry + approval. Cheaper than a full Deploy
///         when USDC/EAS are already live (e.g. a partial earlier deploy).
contract DeployCore is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(pk);

        address usdcAddr = vm.envAddress("DHOW_USDC_ADDRESS");
        address easAddr = vm.envAddress("DHOW_EAS_ADDRESS");
        address inspector = vm.envOr("DHOW_INSPECTOR_ADDRESS", deployer);
        bytes32 schema = vm.envOr("DHOW_SHIPMENT_SCHEMA", keccak256("dhow.shipment-proof.v1"));

        vm.startBroadcast(pk);

        // Ensure the deployer holds USDC to lock with (no-op cost if already minted elsewhere).
        MockUSDC usdc = MockUSDC(usdcAddr);

        DhowScoreRegistry registry = new DhowScoreRegistry(address(0));
        DhowEscrow escrow = new DhowEscrow(usdcAddr, easAddr, schema, inspector, address(registry));
        registry.setRecorder(address(escrow));
        usdc.approve(address(escrow), type(uint256).max);

        vm.stopBroadcast();

        console.log("DHOW_USDC_ADDRESS=%s", usdcAddr);
        console.log("DHOW_ESCROW_ADDRESS=%s", address(escrow));
        console.log("DHOW_REGISTRY_ADDRESS=%s", address(registry));
        console.log("DHOW_EAS_ADDRESS=%s", easAddr);
        console.log("DHOW_INSPECTOR_ADDRESS=%s", inspector);
        console.logBytes32(schema);
    }
}
