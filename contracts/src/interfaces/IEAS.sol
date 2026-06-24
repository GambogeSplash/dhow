// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The Ethereum Attestation Service attestation record. Mirrors the
///         canonical EAS struct so DhowEscrow can verify a shipment proof
///         without pulling the full eas-contracts package as a dependency.

/// @notice Minimal slice of the EAS interface DhowEscrow depends on.
interface IEAS {
    struct Attestation {
        bytes32 uid; // Unique identifier of the attestation. question: how do users, banks, finaciers get this uid?
        bytes32 schema; // Schema of the attestation.
        uint64 time; // Timestamp of the attestation.
        uint64 expirationTime; // Timestamp of the attestation expiration.
        uint64 revocationTime; // Timestamp of the attestation revocation.
        bytes32 refUid; // UID of the attestation this attestation is a reference to.
        address recipient; // Address of the attestation recipient.
        address attester; // Address of the attestation attester.
        bool revocable; // Whether the attestation is revocable.
        bytes data; // Data of the attestation.
    }

    /**
     * @dev Returns the attestation record for a given UID.
     * @param uid The UID of the attestation to retrieve.
     * @return The attestation record.
     */
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}
