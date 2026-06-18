// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The Ethereum Attestation Service attestation record. Mirrors the
///         canonical EAS struct so DhowEscrow can verify a shipment proof
///         without pulling the full eas-contracts package as a dependency.
struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

/// @notice Minimal slice of the EAS interface DhowEscrow depends on.
interface IEAS {
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}
