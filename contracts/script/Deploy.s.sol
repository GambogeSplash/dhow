// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DhowEscrow} from "../src/DhowEscrow.sol";

/// @notice Deploys MockUSDC + DhowEscrow, mints USDC to the deployer (who acts
///         as both payer and attester for the demo) and pre-approves the escrow
///         so locking is a single transaction in the app.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 5_000_000_000_000); // 5,000,000 USDC

        DhowEscrow escrow = new DhowEscrow(address(usdc), deployer);
        usdc.approve(address(escrow), type(uint256).max);

        vm.stopBroadcast();

        console.log("DHOW_USDC_ADDRESS=%s", address(usdc));
        console.log("DHOW_ESCROW_ADDRESS=%s", address(escrow));
        console.log("DHOW_SIGNER_ADDRESS=%s", deployer);
    }
}
