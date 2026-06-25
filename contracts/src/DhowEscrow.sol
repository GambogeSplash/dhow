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
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error DhowEscrow__CorridorExists();
    error DhowEscrow__InvalidSupplier();
    error DhowEscrow__InvalidAmount();
    error DhowEscrow__NotLocked();
    error DhowEscrow__NotExpired();
    error DhowEscrow__EasRequired();
    error DhowEscrow__NotInspector();
    error DhowEscrow__WrongSchema();
    error DhowEscrow__AttestationRevoked();
    error DhowEscrow__AttestationExpired();
    error DhowEscrow__WrongAttester();
    error DhowEscrow__CorridorMismatch();
    error DhowEscrow__InvalidInspector();

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
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

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    IERC20 public immutable I_TOKEN;
    IEAS public immutable I_EAS;
    bytes32 public immutable I_SHIPMENT_SCHEMA;

    /// @notice The inspector authorised to attest shipment proof (e.g. Gulf Inspectorate). Used as the expected EAS attester and, when `requireEas` is off, as the role allowed to release directly.
    address public inspector;
    /// @notice When true, release requires a valid EAS attestation. The owner can flip this off as a stage fallback if EAS is unavailable.
    bool public requireEas;

    mapping(bytes32 corridorId => Lock) public locks;

    /*/////////////////////////////////////////////////////////
                            EVENTS
    /////////////////////////////////////////////////////////*/
    event Locked(
        bytes32 indexed corridorId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline
    );
    event Released(bytes32 indexed corridorId, address indexed supplier, uint256 amount, bytes32 attestationUid);
    event Refunded(bytes32 indexed corridorId, address indexed payer, uint256 amount);
    event InspectorChanged(address indexed inspector);
    event RequireEasChanged(bool requireEas);

    
    /*/////////////////////////////////////////////////////////
                            CONSTRUCTOR
    /////////////////////////////////////////////////////////*/
    constructor(address token_, address eas_, bytes32 shipmentSchema_, address inspector_) Ownable(msg.sender) {
        if (token_ == address(0)) revert DhowEscrow__InvalidSupplier();
        if (inspector_ == address(0)) revert DhowEscrow__InvalidInspector();

        I_TOKEN = IERC20(token_);
        I_EAS = IEAS(eas_);
        I_SHIPMENT_SCHEMA = shipmentSchema_;
        inspector = inspector_;
        requireEas = true;
    }

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function setInspector(address inspector_) external onlyOwner {
        if (inspector_ == address(0)) revert DhowEscrow__InvalidInspector();

        inspector = inspector_;

        emit InspectorChanged(inspector_);
    }

    function setRequireEas(bool requireEas_) external onlyOwner {
        requireEas = requireEas_;
        emit RequireEasChanged(requireEas_);
    }

    /// @notice Lock funds for a corridor. Payer must have approved this contract.
    function lock(bytes32 corridorId, address supplier, uint256 amount, uint64 deadline) external nonReentrant {
        _lock(corridorId, supplier, amount, deadline);
    }

    /// @notice Release funds against a real EAS shipment-proof attestation.
    ///         Permissionless: the attestation is the authorisation. Verifies
    ///         the attestation is the right schema, not revoked, not expired,
    ///         signed by the trusted inspector, and bound to this corridor.
    function releaseWithAttestation(bytes32 corridorId, bytes32 attestationUid) external nonReentrant {
        _releaseWithAttestation(corridorId, attestationUid);
    }

    /// @notice Fallback release by the trusted inspector, available only when
    ///         the owner has turned `requireEas` off (EAS unavailable). Still a
    ///         real on-chain release; identical settlement, weaker proof trail.
    function releaseByInspector(bytes32 corridorId, bytes32 proofRef) external nonReentrant {
        _release(corridorId, proofRef);
    }

    /// @notice Refund the payer after the deadline if no proof was attested.
    function refund(bytes32 corridorId) external nonReentrant {
        _refund(corridorId);
    }

    /*////////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    ////////////////////////////////////////////////////////////////*/
    function _lock(bytes32 corridorId, address supplier, uint256 amount, uint64 deadline) internal {
        if (locks[corridorId].status != Status.None) revert DhowEscrow__CorridorExists();
        if (supplier == address(0)) revert DhowEscrow__InvalidSupplier();
        if (amount == 0) revert DhowEscrow__InvalidAmount();

        locks[corridorId] =
            Lock({payer: msg.sender, supplier: supplier, amount: amount, deadline: deadline, status: Status.Locked});

        I_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        emit Locked(corridorId, msg.sender, supplier, amount, deadline);
    }

    function _releaseWithAttestation(bytes32 corridorId, bytes32 attestationUid) internal {
        if (!requireEas) revert DhowEscrow__EasRequired(); // when EAS is off, use releaseByInspector

        IEAS.Attestation memory att = I_EAS.getAttestation(attestationUid);
        if (att.schema != I_SHIPMENT_SCHEMA) revert DhowEscrow__WrongSchema();
        if (att.revocationTime != 0) revert DhowEscrow__AttestationRevoked();
        if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) revert DhowEscrow__AttestationExpired();
        if (att.attester != inspector) revert DhowEscrow__WrongAttester();

        // The schema leads with the corridorId (static bytes32), so decoding the
        // prefix binds the attestation to this corridor and blocks replay.
        bytes32 attestedCorridor = abi.decode(att.data, (bytes32));
        if (attestedCorridor != corridorId) revert DhowEscrow__CorridorMismatch();

        _release(corridorId, attestationUid);
    }

    function _release(bytes32 corridorId, bytes32 attestationUid) internal {
        if (requireEas) revert DhowEscrow__EasRequired();
        if (msg.sender != inspector) revert DhowEscrow__NotInspector();

        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) revert DhowEscrow__NotLocked();

        l.status = Status.Released;
        I_TOKEN.safeTransfer(l.supplier, l.amount);

        emit Released(corridorId, l.supplier, l.amount, attestationUid);
    }

    function _refund(bytes32 corridorId) internal {
        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) revert DhowEscrow__NotLocked();
        if (block.timestamp <= l.deadline) revert DhowEscrow__NotExpired();

        l.status = Status.Refunded;
        I_TOKEN.safeTransfer(l.payer, l.amount);

        emit Refunded(corridorId, l.payer, l.amount);
    }
    /*//////////////////////////////////////////////////////////////
                    EXTERNAL VIEW & PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function getLock(bytes32 corridorId) external view returns (Lock memory) {
        return locks[corridorId];
    }

    function getInspector() external view returns (address) {
        return inspector;
    }
}
