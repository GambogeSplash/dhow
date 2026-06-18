// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DhowScoreRegistry — on-chain trade-credit reputation.
/// @notice Holds the Corridor Score per business as a verifiable on-chain
///         record. The score is computed off-chain from settled payments (a
///         pure function of history, volume, proof performance and cadence)
///         and posted here by the Dhow poster after each settlement. Any
///         financier reads `scoreOf` / `isEligible` directly from chain: they
///         underwrite the cashflow they can see, not an attestation they must
///         trust. ERC-8004-flavoured: identity-addressed, event-indexed.
contract DhowScoreRegistry is Ownable {
    struct Score {
        uint16 score;
        uint64 updatedAt;
        bytes32 lastAttestation;
    }

    mapping(address business => Score) public scores;

    address public poster;
    uint16 public eligibleThreshold = 70;

    event ScorePosted(address indexed business, uint16 score, bytes32 attestationUid, uint64 at);
    event PosterChanged(address indexed poster);
    event ThresholdChanged(uint16 threshold);

    error NotPoster();

    modifier onlyPoster() {
        if (msg.sender != poster) revert NotPoster();
        _;
    }

    constructor(address poster_) Ownable(msg.sender) {
        poster = poster_;
    }

    function setPoster(address poster_) external onlyOwner {
        poster = poster_;
        emit PosterChanged(poster_);
    }

    function setEligibleThreshold(uint16 threshold_) external onlyOwner {
        eligibleThreshold = threshold_;
        emit ThresholdChanged(threshold_);
    }

    /// @notice Post a freshly computed score for a business. `attestationUid`
    ///         links to the shipment proof that triggered the update (or 0x0).
    function postScore(address business, uint16 score, bytes32 attestationUid) external onlyPoster {
        scores[business] = Score({score: score, updatedAt: uint64(block.timestamp), lastAttestation: attestationUid});
        emit ScorePosted(business, score, attestationUid, uint64(block.timestamp));
    }

    function scoreOf(address business) external view returns (uint16) {
        return scores[business].score;
    }

    function isEligible(address business) external view returns (bool) {
        return scores[business].score >= eligibleThreshold;
    }
}
