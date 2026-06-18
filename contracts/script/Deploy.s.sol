// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DhowEscrow} from "../src/DhowEscrow.sol";
import {DhowScoreRegistry} from "../src/DhowScoreRegistry.sol";
import {MockEAS} from "../test/mocks/MockEAS.sol";

/// @notice Deploys the Dhow on-chain stack: MockUSDC (open-mint testnet asset),
///         DhowEscrow (EAS-gated Proof-Lock) and DhowScoreRegistry (on-chain
///         trade-credit reputation). On a chain with a real EAS deployment,
///         set DHOW_EAS_ADDRESS + DHOW_SHIPMENT_SCHEMA; otherwise a MockEAS is
///         deployed so the local/anvil flow is exercisable end to end.
///         The deployer doubles as inspector and score poster for the demo.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(pk);

        address inspector = vm.envOr("DHOW_INSPECTOR_ADDRESS", deployer);
        address poster = vm.envOr("DHOW_POSTER_ADDRESS", deployer);
        address easAddr = vm.envOr("DHOW_EAS_ADDRESS", address(0));
        bytes32 schema = vm.envOr("DHOW_SHIPMENT_SCHEMA", keccak256("dhow.shipment-proof.v1"));

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 5_000_000_000_000); // 5,000,000 USDC (6dp)

        if (easAddr == address(0)) {
            easAddr = address(new MockEAS());
        }

        DhowEscrow escrow = new DhowEscrow(address(usdc), easAddr, schema, inspector);
        usdc.approve(address(escrow), type(uint256).max);

        DhowScoreRegistry registry = new DhowScoreRegistry(poster);

        vm.stopBroadcast();

        console.log("DHOW_USDC_ADDRESS=%s", address(usdc));
        console.log("DHOW_ESCROW_ADDRESS=%s", address(escrow));
        console.log("DHOW_REGISTRY_ADDRESS=%s", address(registry));
        console.log("DHOW_EAS_ADDRESS=%s", easAddr);
        console.log("DHOW_INSPECTOR_ADDRESS=%s", inspector);
        console.log("DHOW_SIGNER_ADDRESS=%s", deployer);
        console.logBytes32(schema);
    }
}
