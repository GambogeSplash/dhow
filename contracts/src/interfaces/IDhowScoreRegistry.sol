// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IDhowScoreRegistry
 * @author @FemiOje @GambogeSplash @Kelechikizito
 * @notice The slice of the score registry the escrow writes to.
 */
interface IDhowScoreRegistry {
    /// @notice Record a settlement fact against a business. Called by the escrow in the same transaction as the on-chain release/refund.
    function recordSettlement(address business, uint256 amount, bool success, bytes32 attestationUid) external;
}
