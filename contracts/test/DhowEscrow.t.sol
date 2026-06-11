// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DhowEscrow} from "../src/DhowEscrow.sol";

contract DhowEscrowTest is Test {
    MockUSDC usdc;
    DhowEscrow escrow;

    address payer = address(0xA11CE);
    address supplier = address(0xB0B);
    address attester = address(0x1453);
    address stranger = address(0xDEAD);

    bytes32 constant CID = keccak256("DHW-0412");
    uint256 constant AMOUNT = 112_185_160_000; // 112,185.16 USDC (6dp)

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new DhowEscrow(address(usdc), attester);
        usdc.mint(payer, 1_000_000_000_000);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_LockPullsFunds() public {
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));

        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        DhowEscrow.Lock memory l = escrow.getLock(CID);
        assertEq(uint8(l.status), uint8(DhowEscrow.Status.Locked));
        assertEq(l.supplier, supplier);
    }

    function test_AttestReleasesToSupplier() public {
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));

        vm.prank(attester);
        escrow.attestRelease(CID, "Bill of lading - Jebel Ali inbound");

        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getLock(CID).status), uint8(DhowEscrow.Status.Released));
    }

    function test_OnlyAttesterCanRelease() public {
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));

        vm.prank(stranger);
        vm.expectRevert(bytes("not attester"));
        escrow.attestRelease(CID, "spoof");
    }

    function test_RefundAfterDeadline() public {
        uint64 deadline = uint64(block.timestamp + 7 days);
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, deadline);

        vm.warp(deadline + 1);
        escrow.refund(CID);

        assertEq(usdc.balanceOf(payer), 1_000_000_000_000);
        assertEq(uint8(escrow.getLock(CID).status), uint8(DhowEscrow.Status.Refunded));
    }

    function test_NoRefundBeforeDeadline() public {
        uint64 deadline = uint64(block.timestamp + 7 days);
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, deadline);

        vm.expectRevert(bytes("not expired"));
        escrow.refund(CID);
    }

    function test_NoDoubleLock() public {
        vm.startPrank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));
        vm.expectRevert(bytes("exists"));
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));
        vm.stopPrank();
    }
}
