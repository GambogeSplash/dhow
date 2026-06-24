// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DhowEscrow} from "../src/DhowEscrow.sol";
import {Attestation} from "../src/interfaces/IEAS.sol";
import {MockEAS} from "./mocks/MockEAS.sol";

contract DhowEscrowTest is Test {
    MockUSDC usdc;
    MockEAS eas;
    DhowEscrow escrow;

    address payer = address(0xA11CE);
    address supplier = address(0xB0B);
    address inspector = address(0x1453);
    address stranger = address(0xDEAD);

    bytes32 constant CID = keccak256("DHW-0412");
    bytes32 constant SCHEMA = keccak256("shipment-proof");
    uint256 constant AMOUNT = 112_185_160_000; // 112,185.16 USDC (6dp)

    function setUp() public {
        usdc = new MockUSDC();
        eas = new MockEAS();
        escrow = new DhowEscrow(address(usdc), address(eas), SCHEMA, inspector);
        usdc.mint(payer, 1_000_000_000_000);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _lock() internal {
        vm.prank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));
    }

    /// @dev Build a valid shipment-proof attestation for a corridor. The schema
    ///      leads with the corridorId (static bytes32), matching the on-chain decode.
    function _attestation(bytes32 corridorId, bytes32 schema, address attester)
        internal
        pure
        returns (Attestation memory)
    {
        return Attestation({
            uid: keccak256(abi.encode(corridorId, attester)),
            schema: schema,
            time: 0,
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(0),
            attester: attester,
            revocable: true,
            data: abi.encode(corridorId, "DHW-0412", "Bill of Lading", "Jebel Ali", uint64(0), address(0))
        });
    }

    function _setAttestation(bytes32 uid, Attestation memory att) internal {
        eas.set(uid, att);
    }

    function test_LockPullsFunds() public {
        _lock();
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        DhowEscrow.Lock memory l = escrow.getLock(CID);
        assertEq(uint8(l.status), uint8(DhowEscrow.Status.Locked));
        assertEq(l.supplier, supplier);
    }

    function test_ReleaseWithValidAttestation() public {
        _lock();
        bytes32 uid = keccak256("att-1");
        _setAttestation(uid, _attestation(CID, SCHEMA, inspector));

        // Permissionless: anyone can trigger release once a valid attestation exists.
        vm.prank(stranger);
        escrow.releaseWithAttestation(CID, uid);

        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getLock(CID).status), uint8(DhowEscrow.Status.Released));
    }

    function test_RejectsWrongSchema() public {
        _lock();
        bytes32 uid = keccak256("att-wrong-schema");
        _setAttestation(uid, _attestation(CID, keccak256("other-schema"), inspector));

        vm.expectRevert(DhowEscrow.WrongSchema.selector);
        escrow.releaseWithAttestation(CID, uid);
    }

    function test_RejectsWrongAttester() public {
        _lock();
        bytes32 uid = keccak256("att-wrong-attester");
        _setAttestation(uid, _attestation(CID, SCHEMA, stranger));

        vm.expectRevert(DhowEscrow.WrongAttester.selector);
        escrow.releaseWithAttestation(CID, uid);
    }

    function test_RejectsRevokedAttestation() public {
        _lock();
        bytes32 uid = keccak256("att-revoked");
        Attestation memory att = _attestation(CID, SCHEMA, inspector);
        att.revocationTime = uint64(block.timestamp);
        _setAttestation(uid, att);

        vm.expectRevert(DhowEscrow.AttestationRevoked.selector);
        escrow.releaseWithAttestation(CID, uid);
    }

    function test_RejectsCorridorMismatch() public {
        _lock();
        bytes32 uid = keccak256("att-other-corridor");
        _setAttestation(uid, _attestation(keccak256("DHW-9999"), SCHEMA, inspector));

        vm.expectRevert(DhowEscrow.CorridorMismatch.selector);
        escrow.releaseWithAttestation(CID, uid);
    }

    function test_FallbackReleaseOnlyWhenEasOff() public {
        _lock();

        // While requireEas is on, the inspector fallback is blocked.
        vm.prank(inspector);
        vm.expectRevert(DhowEscrow.EasRequired.selector);
        escrow.releaseByInspector(CID, keccak256("manual-proof"));

        // Owner flips EAS off (stage fallback), then the inspector can release.
        escrow.setRequireEas(false);
        vm.prank(inspector);
        escrow.releaseByInspector(CID, keccak256("manual-proof"));

        assertEq(usdc.balanceOf(supplier), AMOUNT);
        assertEq(uint8(escrow.getLock(CID).status), uint8(DhowEscrow.Status.Released));
    }

    function test_FallbackRejectsStranger() public {
        _lock();
        escrow.setRequireEas(false);

        vm.prank(stranger);
        vm.expectRevert(DhowEscrow.NotInspector.selector);
        escrow.releaseByInspector(CID, keccak256("spoof"));
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

        vm.expectRevert(DhowEscrow.NotExpired.selector);
        escrow.refund(CID);
    }

    function test_NoDoubleLock() public {
        vm.startPrank(payer);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));
        vm.expectRevert(DhowEscrow.CorridorExists.selector);
        escrow.lock(CID, supplier, AMOUNT, uint64(block.timestamp + 7 days));
        vm.stopPrank();
    }
}
