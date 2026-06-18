// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {DhowScoreRegistry} from "../src/DhowScoreRegistry.sol";

contract DhowScoreRegistryTest is Test {
    DhowScoreRegistry registry;

    address poster = address(0xC0FFEE);
    address business = address(0xB12);
    address stranger = address(0xDEAD);

    function setUp() public {
        registry = new DhowScoreRegistry(poster);
    }

    function test_PostScoreUpdatesState() public {
        bytes32 uid = keccak256("att-1");
        vm.prank(poster);
        registry.postScore(business, 72, uid);

        assertEq(registry.scoreOf(business), 72);
        assertTrue(registry.isEligible(business));
        (uint16 score,, bytes32 last) = registry.scores(business);
        assertEq(score, 72);
        assertEq(last, uid);
    }

    function test_BelowThresholdNotEligible() public {
        vm.prank(poster);
        registry.postScore(business, 66, bytes32(0));
        assertEq(registry.scoreOf(business), 66);
        assertFalse(registry.isEligible(business));
    }

    function test_OnlyPosterCanPost() public {
        vm.prank(stranger);
        vm.expectRevert(DhowScoreRegistry.NotPoster.selector);
        registry.postScore(business, 90, bytes32(0));
    }

    function test_OwnerCanRotatePoster() public {
        registry.setPoster(stranger);
        vm.prank(stranger);
        registry.postScore(business, 80, bytes32(0));
        assertEq(registry.scoreOf(business), 80);
    }
}
