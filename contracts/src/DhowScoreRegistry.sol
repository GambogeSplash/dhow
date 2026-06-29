// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DhowScoreRegistry — on-chain trade-credit reputation, computed from facts.
/// @notice The underwriting primitive, on-chain. The registry stores the RAW
///         settlement facts per business (how many payments released cleanly,
///         how many refunded, cumulative volume, recency) and computes the
///         trade-credit score from them at read time. The facts are written
///         ONLY by the escrow contract, in the SAME transaction as the on-chain
///         settlement, so the score moves atomically with the money. No backend
///         server is in the trust path: if Dhow's servers are down, eligibility
///         still updates on-chain and any financier can recompute it from the
///         immutable facts. ERC-8004-flavoured: identity-addressed,
///         event-indexed, permissionlessly readable.
contract DhowScoreRegistry is Ownable {
    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    /// @notice Immutable settlement facts for a business, appended atomically by
    ///         the escrow on every release/refund. Sufficient to recompute the
    ///         score with no off-chain input beyond the current block time.
    struct Stats {
        uint64 settledCount; // payments released clean to the supplier
        uint64 refundedCount; // payments refunded (proof failed / timed out)
        uint128 settledVolume; // cumulative settled USDC (6dp)
        uint64 firstSettledAt; // first clean settlement (ms-agnostic, unix secs)
        uint64 lastSettledAt; // most recent clean settlement
        bytes32 lastAttestation; // proof UID behind the last settlement
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    mapping(address business => Stats) public stats;

    /// @notice The escrow contract authorised to record settlement facts. Set by
    ///         the owner at wire-up; thereafter the score is driven by on-chain
    ///         settlement, not by a privileged off-chain poster.
    address public recorder;

    uint16 public eligibleThreshold = 70;
    uint16 public preferredThreshold = 88;

    /*//////////////////////////////////////////////////////////////
                          SCORING CONSTANTS
    //////////////////////////////////////////////////////////////*/
    // Mirrors creditScore in lib/credit.ts: history(30) + volume(25) + performance(30) + cadence(15) = 100.
    uint256 internal constant W_HISTORY = 30;
    uint256 internal constant W_VOLUME = 25;
    uint256 internal constant W_PERFORMANCE = 30;
    uint256 internal constant W_CADENCE = 15;
    uint64 internal constant HISTORY_CAP = 6; // settlements for full history credit
    // Volume cap: AED 1,000,000 ≈ 272,294 USDC at the CBUAE peg (3.6725), in 6dp.
    uint128 internal constant VOLUME_CAP = 272_294_000_000;
    uint64 internal constant CADENCE_WINDOW = 45 days; // recency decay window

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event SettlementRecorded(
        address indexed business, bool success, uint256 amount, bytes32 attestationUid, uint16 newScore
    );
    event RecorderChanged(address indexed recorder);
    event ThresholdsChanged(uint16 eligible, uint16 preferred);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error DhowScoreRegistry__NotRecorder();
    error DhowScoreRegistry__InvalidThresholds();

    modifier onlyRecorder() {
        if (msg.sender != recorder) revert DhowScoreRegistry__NotRecorder();
        _;
    }

    constructor(address recorder_) Ownable(msg.sender) {
        recorder = recorder_;
    }

    /*//////////////////////////////////////////////////////////////
                            OWNER CONTROLS
    //////////////////////////////////////////////////////////////*/
    function setRecorder(address recorder_) external onlyOwner {
        recorder = recorder_;
        emit RecorderChanged(recorder_);
    }

    function setThresholds(uint16 eligible_, uint16 preferred_) external onlyOwner {
        if (eligible_ > preferred_ || preferred_ > 100) revert DhowScoreRegistry__InvalidThresholds();
        eligibleThreshold = eligible_;
        preferredThreshold = preferred_;
        emit ThresholdsChanged(eligible_, preferred_);
    }

    /*//////////////////////////////////////////////////////////////
                          SETTLEMENT RECORDING
    //////////////////////////////////////////////////////////////*/
    /// @notice Record a settlement fact. Called by the escrow in the SAME tx as
    ///         the on-chain release/refund — the score update is therefore as
    ///         live and censorship-proof as the settlement itself.
    /// @param business  the importer whose track record this settles against
    /// @param amount    settled USDC (6dp); only counted toward volume on success
    /// @param success   true on clean release to supplier, false on refund
    /// @param attestationUid the shipment-proof UID behind a clean release (or 0)
    function recordSettlement(address business, uint256 amount, bool success, bytes32 attestationUid)
        external
        onlyRecorder
    {
        Stats storage s = stats[business];
        if (success) {
            s.settledCount += 1;
            s.settledVolume += uint128(amount);
            if (s.firstSettledAt == 0) s.firstSettledAt = uint64(block.timestamp);
            s.lastSettledAt = uint64(block.timestamp);
            s.lastAttestation = attestationUid;
        } else {
            s.refundedCount += 1;
        }
        emit SettlementRecorded(business, success, amount, attestationUid, _score(s, block.timestamp));
    }

    /*//////////////////////////////////////////////////////////////
                          SCORE (LIVE, ON-CHAIN)
    //////////////////////////////////////////////////////////////*/
    /// @notice Trade-credit score (0..100), computed from on-chain facts at read
    ///         time. Recency decays against real elapsed time, so the number is
    ///         honest whether or not any transaction has fired recently.
    function scoreOf(address business) public view returns (uint16) {
        return _score(stats[business], block.timestamp);
    }

    function isEligible(address business) external view returns (bool) {
        return scoreOf(business) >= eligibleThreshold;
    }

    function isPreferred(address business) external view returns (bool) {
        return scoreOf(business) >= preferredThreshold;
    }

    /// @notice The raw facts a financier underwrites, in one read.
    function statsOf(address business) external view returns (Stats memory) {
        return stats[business];
    }

    /// @dev Pure scoring function. Integer arithmetic mirroring creditScore in
    ///      lib/credit.ts closely enough that on- and off-chain numbers agree within rounding.
    function _score(Stats memory s, uint256 nowTs) internal pure returns (uint16) {
        // history: min(count, CAP) / CAP * 30
        uint256 cappedCount = s.settledCount < HISTORY_CAP ? s.settledCount : HISTORY_CAP;
        uint256 history = (cappedCount * W_HISTORY) / HISTORY_CAP;

        // volume: clamp01(volume / CAP) * 25
        uint256 volume = s.settledVolume >= VOLUME_CAP
            ? W_VOLUME
            : (uint256(s.settledVolume) * W_VOLUME) / VOLUME_CAP;

        // performance: settledCount > 0 ? settled / (settled + refunded) * 30 : 0.
        // A business with no settlements has no track record and earns 0 here.
        uint256 performance;
        uint256 resolved = uint256(s.settledCount) + s.refundedCount;
        if (s.settledCount > 0) {
            performance = (uint256(s.settledCount) * W_PERFORMANCE) / resolved;
        }

        // cadence: count>=2 ? clamp01(1 - daysSinceLast/45) * 15 ; count==1 ? 7 ; else 0
        uint256 cadence;
        if (s.settledCount >= 2) {
            uint256 elapsed = nowTs > s.lastSettledAt ? nowTs - s.lastSettledAt : 0;
            if (elapsed < CADENCE_WINDOW) {
                cadence = ((CADENCE_WINDOW - elapsed) * W_CADENCE) / CADENCE_WINDOW;
            }
        } else if (s.settledCount == 1) {
            cadence = W_CADENCE / 2; // mirrors off-chain count/2 (0.5) * 15
        }

        uint256 total = history + volume + performance + cadence;
        // Safe: every weight sums to <= 100 and the ternary caps at 100.
        // forge-lint: disable-next-line(unsafe-typecast)
        return total > 100 ? 100 : uint16(total);
    }
}
