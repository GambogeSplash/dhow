// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IEAS, Attestation} from "../../src/interfaces/IEAS.sol";

/// @notice Minimal EAS stand-in for tests. Lets a test set an attestation record
///         for a uid, which DhowEscrow.releaseWithAttestation then reads.
contract MockEAS is IEAS {
    mapping(bytes32 => Attestation) internal _attestations;

    function set(bytes32 uid, Attestation memory att) external {
        _attestations[uid] = att;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _attestations[uid];
    }
}
