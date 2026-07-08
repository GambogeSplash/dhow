// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEAS} from "./interfaces/IEAS.sol";
import {IDhowScoreRegistry} from "./interfaces/IDhowScoreRegistry.sol";

/**
 * @title DhowEscrow
 * @author @FemiOje @GambogeSplash @Kelechikizito
 * @notice  Holds USDC for a payment and releases to the supplier when the shipment proof is attested. 
 * The release is gated on a real EAS attestation signed by a trusted inspector: the attestation IS the authorisation, so release is permissionless once one exists. 
 * A role-based fallback (`releaseByInspector`) stays available only when the owner has flipped `requireEas` off, for environments where EAS is unavailable. 
 * Buyer is refunded after the deadline if no proof arrives.
 */
contract DhowEscrow is Ownable, ReentrancyGuard {
    /*/////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error DhowEscrow__PaymentExists();
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
    error DhowEscrow__PaymentMismatch();
    error DhowEscrow__InvalidInspector();
    error DhowEscrow__InvalidEAS();
    error DhowEscrow__InvalidRegistry();

    /*//////////////////////////////////////////////////////////////
                        TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    using SafeERC20 for IERC20;

    enum Status {
        None, // None/0 is the default value for an uninitialized paymentId. PS: None is never explicitly initialised — it's the absence of initialisation that makes it None.
        Locked, // Locked/1 is when the buyer/payer has deposited USDC and it's sitting in the escrow waiting for proof.
        Released, // Released/2 is when the inspector has attested the proof and the escrow has released the USDC to the supplier.
        Refunded // Refunded/3 is when the buyer/payer has been refunded after the deadline because no proof was attested.
    }

    struct Lock {
        address payer; // The payer or buyer is the importer that pays the suppliers in stablecoin.
        address supplier; // The supplier or overseas seller is the exporter being paid in stablecoin. Suppliers receive USDC into their wallet when _release() calls token.safeTransfer(l.supplier, l.amount). 
        uint256 amount; // This is the amount of USDC/stablecoin locked for the payment
        uint64 deadline; // The deadline is the unix timestamp after which the payer can be refunded if no proof has been attested.
        Status status; // The status of the payment represented by an enum: None, Locked, Released, Refunded
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    /// @dev The interface to the stablecoiun used for payments. In this case, and erc20 token.
    IERC20 private immutable I_TOKEN;
    /// @dev The interface to the EAS contract used to verify the shipment proof attestation. 
    IEAS private immutable I_EAS;
    /// @dev The schema used to verify the shipment proof attestation.
    bytes32 private immutable I_SHIPMENT_SCHEMA;
    /// @dev The interface of the on-chain credit registry notified on every settlement.
    IDhowScoreRegistry private immutable I_REGISTRY;

    /// @dev The address of the inspector authorised to attest shipment proof (e.g. Gulf Inspectorate) as long as `requireEas` is true. The inspector is the only address that can call `releaseByInspector()` when EAS is unavailable.
    /// @notice The inspector is a trusted real-world entity (like Gulf Inspectorate) whose job is to physically verify that goods arrived and then sign an on-chain attestation confirming it — that signature is what unlocks the USDC from escrow to the supplier.
    address private s_inspector;
    /// @dev When true, release requires a valid EAS attestation. The owner can flip this off if EAS is unavailable.
    bool private s_requireEas;

    /// @dev The locks mapping maps every paymentId to its Lock struct, which contains the payer, supplier, amount, deadline, and status of the payment.
    mapping(bytes32 paymentId => Lock) private s_locks;

    /*/////////////////////////////////////////////////////////
                            EVENTS
    /////////////////////////////////////////////////////////*/
    /// @notice This event is emitted when a payment is locked in escrow. It contains the paymentId, payer, supplier, amount, and deadline.
    event Locked(
        bytes32 indexed paymentId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline
    );
    /// @notice This event is emitted when a payment is released to the supplier. It contains the paymentId, supplier, amount, and attestationUid.
    event Released(bytes32 indexed paymentId, address indexed supplier, uint256 amount, bytes32 attestationUid);
    /// @notice This event is emitted when a payment is refunded to the payer after the deadline. It contains the paymentId, payer, and amount.
    event Refunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);
    /// @notice This event is emitted when the inspector address is changed. It contains the new inspector address.
    event InspectorChanged(address indexed inspector);
    /// @notice This event is emitted when the requireEas boolean flag is changed. It contains the new boolean value of requireEas.
    event RequireEasChanged(bool requireEas);
    /// @notice Emitted when settlement succeeded but the registry notification reverted. Money moved; only the reputation write was skipped.
    event SettlementRecordFailed(bytes32 indexed paymentId, address indexed business, bool success);
    // event RegistryChanged(address indexed registry);

    /*/////////////////////////////////////////////////////////
                            CONSTRUCTOR
    /////////////////////////////////////////////////////////*/
    /// @dev The constructor sets the immutable addresses of the stablecoin, EAS, shipment schema,and registry. The inspector address isn't immuatable. The constructor also sets the s_requireEs flag to true.
    /// @notice question: Right now, the Escrow deployer is the owner. Should this be case, given the owner has certain privileges?
    constructor(address token_, address eas_, bytes32 shipmentSchema_, address inspector_, address registry_)
        Ownable(msg.sender)
    {
        // Checks to validate addresses
        if (token_ == address(0)) revert DhowEscrow__InvalidSupplier();
        if (inspector_ == address(0)) revert DhowEscrow__InvalidInspector();
        if (eas_ == address(0)) revert DhowEscrow__InvalidEAS();
        if (registry_ == address(0)) revert DhowEscrow__InvalidRegistry();

        // Intialize the immutable and storage state variables
        I_TOKEN = IERC20(token_);
        I_EAS = IEAS(eas_);
        I_SHIPMENT_SCHEMA = shipmentSchema_;
        s_inspector = inspector_;

        s_requireEas = true;
        I_REGISTRY = IDhowScoreRegistry(registry_);
    }

    /*//////////////////////////////////////////////////////////////
                        EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /// @notice Point the escrow at the on-chain score registry. The registry must
    ///         in turn set this escrow as its `recorder`.
    // function setRegistry(address registry_) external onlyOwner {
    //     if (registry_ == address(0)) revert DhowEscrow__InvalidRegistry();

    //     I_REGISTRY = IDhowScoreRegistry(registry_);
    //     emit RegistryChanged(registry_);
    // } // commented out because the registry is now immutable and set in the constructor.

    /**
     * @dev Setter function to change the inspector address, only callable by the owner. Emits InspectorChanged event.
     * @param inspector_ The new inspector address to be set.
     */
    function setInspector(address inspector_) external onlyOwner {
        if (inspector_ == address(0)) revert DhowEscrow__InvalidInspector();

        s_inspector = inspector_;

        emit InspectorChanged(s_inspector);
    }

    /**
     * @dev Setter function to change the requireEas boolean flag, only callable by the owner. Emits RequireEasChanged event.
     * @param requireEas_ The new boolean value to be set for requireEas.
     */
    function setRequireEas(bool requireEas_) external onlyOwner {
        s_requireEas = requireEas_;
        emit RequireEasChanged(requireEas_);
    }

    /**
     * @notice Lock funds for a payment. Payer must have approved this contract.
     * @dev External function to lock funds for a payment.
     * @param paymentId The ID of the payment to lock.
     * @param supplier The address of the supplier.
     * @param amount The amount of funds to lock.
     * @param deadline The deadline for the payment.
     */
    function lock(bytes32 paymentId, address supplier, uint256 amount, uint64 deadline) external nonReentrant {
        _lock(paymentId, supplier, amount, deadline);
    }

    
    /**
     * @notice Release funds against a real EAS shipment-proof attestation. This is the primary release path, used when requireEas = true.
     * @dev External function to release funds against a real EAS shipment-proof attestation.
     * @param paymentId The ID of the payment to release.
     * @param attestationUid The UID of the EAS attestation.
     */
    function releaseWithAttestation(bytes32 paymentId, bytes32 attestationUid) external nonReentrant {
        _releaseWithAttestation(paymentId, attestationUid);
    }

    /**
     * @notice Fallback release by the trusted inspector. Used when requireEas = false. Only the inspector address can call this 
     * @param paymentId The ID of the payment to release.
     * @param proofRef The reference for the proof. proofRef is just a bytes32 value the inspector passes in to reference whatever off-chain proof they used to verify the shipment — a document hash, a reference number, anything.
     */
    function releaseByInspector(bytes32 paymentId, bytes32 proofRef) external nonReentrant {
        _release(paymentId, proofRef);
    }

    /**
     * @notice Refund the payer after the deadline if no proof was attested.
     * @dev External function to refund the payer after the deadline if no proof was attested.
     * @param paymentId The ID of the payment to refund.
     */
    function refund(bytes32 paymentId) external nonReentrant {
        _refund(paymentId);
    }

    /*////////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    ////////////////////////////////////////////////////////////////*/
    /**
     * @notice Lock funds for a payment. Payer must have approved this contract.
     * @dev Internal function to lock funds for a payment.
     * @param paymentId The ID of the payment to lock.
     * @param supplier The address of the supplier.
     * @param amount The amount of funds to lock.
     * @param deadline The deadline for the payment.
     */
    function _lock(bytes32 paymentId, address supplier, uint256 amount, uint64 deadline) internal {
        if (s_locks[paymentId].status != Status.None) revert DhowEscrow__PaymentExists();
        if (supplier == address(0)) revert DhowEscrow__InvalidSupplier();
        if (amount == 0) revert DhowEscrow__InvalidAmount();

        s_locks[paymentId] =
            Lock({payer: msg.sender, supplier: supplier, amount: amount, deadline: deadline, status: Status.Locked});

        I_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        emit Locked(paymentId, msg.sender, supplier, amount, deadline);
    }

    /**
     * @notice Release funds against a real EAS shipment-proof attestation. This is the primary release path, used when requireEas = true.
     * @dev Internal function to release funds against a real EAS shipment-proof attestation.
     * @param paymentId The ID of the payment to release.
     * @param attestationUid The UID of the EAS attestation.
     */
    function _releaseWithAttestation(bytes32 paymentId, bytes32 attestationUid) internal {
        if (!s_requireEas) revert DhowEscrow__EasRequired(); // when EAS is off, use releaseByInspector

        IEAS.Attestation memory att = I_EAS.getAttestation(attestationUid);
        if (att.schema != I_SHIPMENT_SCHEMA) revert DhowEscrow__WrongSchema();
        if (att.revocationTime != 0) revert DhowEscrow__AttestationRevoked();
        if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) revert DhowEscrow__AttestationExpired();
        if (att.attester != s_inspector) revert DhowEscrow__WrongAttester();

        // The schema leads with the paymentId (static bytes32), so decoding the
        // prefix binds the attestation to this payment and blocks replay.
        bytes32 attestedPayment = abi.decode(att.data, (bytes32));
        if (attestedPayment != paymentId) revert DhowEscrow__PaymentMismatch();

        _settle(paymentId, attestationUid);
    }

    /**
     * @notice Release funds without an EAS attestation.
     * @dev Internal function to release funds without an EAS attestation.
     * @param paymentId The ID of the payment to release.
     * @param proofRef The reference to the proof of shipment.
     */
    function _release(bytes32 paymentId, bytes32 proofRef) internal {
        if (s_requireEas) revert DhowEscrow__EasRequired();
        if (msg.sender != s_inspector) revert DhowEscrow__NotInspector();
        _settle(paymentId, proofRef);
    }

    /**
     * @notice The settlement core, shared by the attestation and inspector paths.
     * @dev Moves the money, then records the settlement fact on-chain in the
     *      same transaction. The release-path guards live in the callers, so
     *      this never carries a contradictory `requireEas` condition.
     * @param paymentId The ID of the payment to settle.
     * @param attestationUid The UID of the EAS attestation.
     */
    function _settle(bytes32 paymentId, bytes32 attestationUid) internal {
        Lock storage l = s_locks[paymentId];
        if (l.status != Status.Locked) revert DhowEscrow__NotLocked();

        l.status = Status.Released;
        I_TOKEN.safeTransfer(l.supplier, l.amount);

        emit Released(paymentId, l.supplier, l.amount, attestationUid);
        _recordSettlement(paymentId, l.payer, l.amount, true, attestationUid);
    }

    /**
     * @notice Refund the payer after the deadline if no proof was attested.
     * @dev Internal function to refund the payer after the deadline if no proof was attested.
     * @param paymentId The ID of the payment to refund.
     */
    function _refund(bytes32 paymentId) internal {
        Lock storage l = s_locks[paymentId];
        if (l.status != Status.Locked) revert DhowEscrow__NotLocked();
        if (block.timestamp <= l.deadline) revert DhowEscrow__NotExpired();

        l.status = Status.Refunded;
        I_TOKEN.safeTransfer(l.payer, l.amount);

        emit Refunded(paymentId, l.payer, l.amount);
        _recordSettlement(paymentId, l.payer, l.amount, false, bytes32(0));
    }

    /**
     * @notice Notify the on-chain registry of a settlement.
     * @dev Wrapped in try/catch so a misconfigured or paused registry can never block the money moving; a failed notification surfaces as an event for off-chain repair.
     * @param paymentId The ID of the payment to record.
     * @param business The address of the business involved.
     * @param amount The amount of the payment.
     * @param success The success status of the settlement.
     * @param attestationUid The UID of the EAS attestation.
     */
    function _recordSettlement(
        bytes32 paymentId,
        address business,
        uint256 amount,
        bool success,
        bytes32 attestationUid
    ) internal {
        IDhowScoreRegistry r = I_REGISTRY;
        if (address(r) == address(0)) return;
        try r.recordSettlement(business, amount, success, attestationUid) {}
        catch {
            emit SettlementRecordFailed(paymentId, business, success);
        }
    }
    /*//////////////////////////////////////////////////////////////
                    EXTERNAL VIEW & PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    /**
     * @dev Returns the Lock struct for a given paymentId.
     * @param paymentId The ID of the payment for which to retrieve the lock.
     */
    function getLock(bytes32 paymentId) external view returns (Lock memory) {
        return s_locks[paymentId];
    }

    /**
     * @dev Returns the current inspector address.
     */
    function getInspector() external view returns (address) {
        return s_inspector;
    }

    /**
     * @dev Returns the current registry address.
     */
    function getRegistry() external view returns (address) {
        return address(I_REGISTRY);
    }
}
