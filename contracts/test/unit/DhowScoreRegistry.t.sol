// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {DhowScoreRegistry} from "../../src/DhowScoreRegistry.sol";

contract DhowScoreRegistryTest is Test {
    DhowScoreRegistry registry;

    address recorder = address(0xC0FFEE); // stands in for the escrow contract
    address business = address(0xB12);
    address stranger = address(0xDEAD);

    uint256 constant CORRIDOR = 200_000_000_000; // 200,000 USDC (6dp)

    function setUp() public {
        registry = new DhowScoreRegistry(address(0));
        registry.setRecorder(recorder);
    }

    function _record(bool success) internal {
        vm.prank(recorder);
        registry.recordSettlement(business, CORRIDOR, success, keccak256("uid"));
    }

    function test_OnlyRecorderCanRecord() public {
        vm.prank(stranger);
        vm.expectRevert(DhowScoreRegistry.DhowScoreRegistry__NotRecorder.selector);
        registry.recordSettlement(business, CORRIDOR, true, bytes32(0));
    }

    function test_NewBusinessScoresZero() public view {
        assertEq(registry.scoreOf(business), 0);
        assertFalse(registry.isEligible(business));
    }

    function test_SettlementsAccumulateFactsAndScore() public {
        _record(true);
        DhowScoreRegistry.Stats memory s = registry.statsOf(business);
        assertEq(s.settledCount, 1);
        assertEq(s.settledVolume, CORRIDOR);
        assertGt(registry.scoreOf(business), 0);
    }

    /// @notice A track record of clean settlements crosses the eligibility line —
    ///         driven entirely by on-chain facts, no off-chain poster involved.
    function test_RepeatSettlementsBecomeEligible() public {
        for (uint256 i = 0; i < 6; i++) {
            vm.prank(recorder);
            registry.recordSettlement(business, CORRIDOR, true, keccak256(abi.encode(i)));
        }
        assertTrue(registry.isEligible(business));
    }

    function test_RefundsDragPerformanceDown() public {
        // Two clean, then a refund — score must fall vs three clean.
        _record(true);
        _record(true);
        uint16 before = registry.scoreOf(business);
        _record(false);
        assertLt(registry.scoreOf(business), before);
        assertEq(registry.statsOf(business).refundedCount, 1);
    }

    /// @notice Cadence decays with real elapsed time, so a stale business loses
    ///         standing even if nobody touches the contract.
    function test_CadenceDecaysOverTime() public {
        _record(true);
        _record(true);
        uint16 fresh = registry.scoreOf(business);
        vm.warp(block.timestamp + 60 days); // past the 45-day cadence window
        assertLt(registry.scoreOf(business), fresh);
    }

    function test_OwnerCanRotateRecorder() public {
        registry.setRecorder(stranger);
        vm.prank(stranger);
        registry.recordSettlement(business, CORRIDOR, true, bytes32(0));
        assertEq(registry.statsOf(business).settledCount, 1);
    }

    function test_OwnerCanSetThresholds() public {
        registry.setThresholds(50, 80);
        assertEq(registry.eligibleThreshold(), 50);
        assertEq(registry.preferredThreshold(), 80);
    }

    function test_RejectsInvalidThresholds() public {
        vm.expectRevert(DhowScoreRegistry.DhowScoreRegistry__InvalidThresholds.selector);
        registry.setThresholds(90, 80); // eligible above preferred
    }
}
