// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IEAS, Attestation} from "../../src/interfaces/IEAS.sol";

/// @notice A minimal, EAS-interface-compatible on-chain attestation registry.
///         Used as the Dhow attestation contract until a chain has canonical
///         EAS deployed: `attest` records a real on-chain attestation (the
///         caller is the attester), and `getAttestation` is what DhowEscrow
///         reads to verify a shipment proof. `set` is a test convenience.
contract MockEAS is IEAS {
    mapping(bytes32 => Attestation) internal _attestations;
    uint256 public nonce;

    event Attested(bytes32 indexed uid, bytes32 indexed schema, address indexed attester, address recipient);

    /// @notice Record an attestation; the caller is the attester. Returns its uid.
    function attest(bytes32 schema, address recipient, uint64 expirationTime, bytes calldata data)
        external
        returns (bytes32 uid)
    {
        uid = keccak256(abi.encode(schema, msg.sender, recipient, data, nonce++));
        _attestations[uid] = Attestation({
            uid: uid,
            schema: schema,
            time: uint64(block.timestamp),
            expirationTime: expirationTime,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: recipient,
            attester: msg.sender,
            revocable: true,
            data: data
        });
        emit Attested(uid, schema, msg.sender, recipient);
    }

    /// @notice Test helper: set a full attestation record for a uid directly.
    function set(bytes32 uid, Attestation memory att) external {
        _attestations[uid] = att;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }
}
