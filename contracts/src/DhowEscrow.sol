// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEAS} from "./interfaces/IEAS.sol";

/// @title DhowEscrow — Proof-Lock conditional settlement.
/// @notice Holds USDC for a corridor and releases to the supplier when the
///         shipment proof is attested. The release is gated on a real EAS
///         attestation signed by a trusted inspector: the attestation IS the
///         authorisation, so release is permissionless once one exists. A
///         role-based fallback (`releaseByInspector`) stays available only when
///         the owner has flipped `requireEas` off, for environments where EAS
///         is unavailable. Buyer is refunded after the deadline if no proof
///         arrives.
contract DhowEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Locked,
        Released,
        Refunded
    }

    struct Lock {
        address payer;
        address supplier;
        uint256 amount;
        uint64 deadline;
        Status status;
    }

    IERC20 public immutable token;
    IEAS public immutable eas;
    bytes32 public immutable shipmentSchema;

    /// @notice The inspector authorised to attest shipment proof (e.g. Gulf
    ///         Inspectorate). Used as the expected EAS attester and, when
    ///         `requireEas` is off, as the role allowed to release directly.
    address public inspector;

    /// @notice When true, release requires a valid EAS attestation. The owner
    ///         can flip this off as a stage fallback if EAS is unavailable.
    bool public requireEas;

    mapping(bytes32 corridorId => Lock) public locks;

    event Locked(
        bytes32 indexed corridorId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline
    );
    event Released(bytes32 indexed corridorId, address indexed supplier, uint256 amount, bytes32 attestationUid);
    event Refunded(bytes32 indexed corridorId, address indexed payer, uint256 amount);
    event InspectorChanged(address indexed inspector);
    event RequireEasChanged(bool requireEas);

    error CorridorExists();
    error InvalidSupplier();
    error InvalidAmount();
    error NotLocked();
    error NotExpired();
    error EasRequired();
    error NotInspector();
    error WrongSchema();
    error AttestationRevoked();
    error AttestationExpired();
    error WrongAttester();
    error CorridorMismatch();

    constructor(address token_, address eas_, bytes32 shipmentSchema_, address inspector_) Ownable(msg.sender) {
        if (token_ == address(0)) revert InvalidSupplier();
        token = IERC20(token_);
        eas = IEAS(eas_);
        shipmentSchema = shipmentSchema_;
        inspector = inspector_;
        requireEas = true;
    }

    function setInspector(address inspector_) external onlyOwner {
        inspector = inspector_;
        emit InspectorChanged(inspector_);
    }

    function setRequireEas(bool requireEas_) external onlyOwner {
        requireEas = requireEas_;
        emit RequireEasChanged(requireEas_);
    }

    /// @notice Lock funds for a corridor. Payer must have approved this contract.
    function lock(bytes32 corridorId, address supplier, uint256 amount, uint64 deadline) external nonReentrant {
        if (locks[corridorId].status != Status.None) revert CorridorExists();
        if (supplier == address(0)) revert InvalidSupplier();
        if (amount == 0) revert InvalidAmount();

        locks[corridorId] =
            Lock({payer: msg.sender, supplier: supplier, amount: amount, deadline: deadline, status: Status.Locked});

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Locked(corridorId, msg.sender, supplier, amount, deadline);
    }

    /// @notice Release funds against a real EAS shipment-proof attestation.
    ///         Permissionless: the attestation is the authorisation. Verifies
    ///         the attestation is the right schema, not revoked, not expired,
    ///         signed by the trusted inspector, and bound to this corridor.
    function releaseWithAttestation(bytes32 corridorId, bytes32 attestationUid) external nonReentrant {
        if (!requireEas) revert EasRequired(); // when EAS is off, use releaseByInspector

        IEAS.Attestation memory att = eas.getAttestation(attestationUid);
        if (att.schema != shipmentSchema) revert WrongSchema();
        if (att.revocationTime != 0) revert AttestationRevoked();
        if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) revert AttestationExpired();
        if (att.attester != inspector) revert WrongAttester();

        // The schema leads with the corridorId (static bytes32), so decoding the
        // prefix binds the attestation to this corridor and blocks replay.
        bytes32 attestedCorridor = abi.decode(att.data, (bytes32));
        if (attestedCorridor != corridorId) revert CorridorMismatch();

        _release(corridorId, attestationUid);
    }

    /// @notice Fallback release by the trusted inspector, available only when
    ///         the owner has turned `requireEas` off (EAS unavailable). Still a
    ///         real on-chain release; identical settlement, weaker proof trail.
    function releaseByInspector(bytes32 corridorId, bytes32 proofRef) external nonReentrant {
        if (requireEas) revert EasRequired();
        if (msg.sender != inspector) revert NotInspector();
        _release(corridorId, proofRef);
    }

    function _release(bytes32 corridorId, bytes32 attestationUid) internal {
        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) revert NotLocked();

        l.status = Status.Released;
        token.safeTransfer(l.supplier, l.amount);

        emit Released(corridorId, l.supplier, l.amount, attestationUid);
    }

    /// @notice Refund the payer after the deadline if no proof was attested.
    function refund(bytes32 corridorId) external nonReentrant {
        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) revert NotLocked();
        if (block.timestamp <= l.deadline) revert NotExpired();

        l.status = Status.Refunded;
        token.safeTransfer(l.payer, l.amount);

        emit Refunded(corridorId, l.payer, l.amount);
    }

    function getLock(bytes32 corridorId) external view returns (Lock memory) {
        return locks[corridorId];
    }
}
