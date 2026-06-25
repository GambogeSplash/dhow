// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The slice of the score registry the escrow writes to. Kept as a
///         minimal vendored interface (like IEAS) so the escrow has no
///         compile-time dependency on the full registry implementation.
interface IDhowScoreRegistry {
    /// @notice Record a settlement fact against a business. Called by the escrow
    ///         (the registry's `recorder`) in the same transaction as the
    ///         on-chain release/refund.
    function recordSettlement(address business, uint256 amount, bool success, bytes32 attestationUid) external;
}
