// SPDX-License-Identifier: MIT
pragma solidity 0.8.24; //@GambogeSplash nitpick: use a pinned compiler version

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// interface IERC20 {
//     function transfer(address to, uint256 amount) external returns (bool);
//     function transferFrom(address from, address to, uint256 amount) external returns (bool);
// }

/// @title DhowEscrow — Proof-Lock conditional settlement.
/// @notice Holds USDC for a corridor and releases to the supplier when the
///         shipment proof is attested. In production the attester check is an
///         EAS attestation; here it is an attester role. Buyer is refunded
///         after the deadline if no proof arrives.
contract DhowEscrow is Ownable, /*AccessControl,*/ ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    /// @dev This error is thrown when a function that requires the caller to be the attester is called by an address that is not the attester.
    error DhowEscrow__NotAttester();
    /// @dev This error is thrown when an invalid address is provided.
    error DhowEscrow__InvalidAttesterAddress();
    /// @dev This error is thrown when an invalid token address is provided.
    error DhowEscrow__InvalidToken();
    /// @dev This error is thrown when an invalid supplier address is provided.
    error DhowEscrow__InvalidSupplierAddress();
    /// @dev This error is thrown when an invalid amount is provided.
    error DhowEscrow__InvalidAmount();
    /// @dev This error is thrown when the status of a lock is not locked.
    error DhowEscrow__StatusNotLocked();
    error DhowEscrow__DeadlineNotPassed();
    

    /*//////////////////////////////////////////////////////////////
                           TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/
    /// @dev The Status enum represents the different states of a lock in the escrow contract.
    enum Status {
        None,
        Locked,
        Released,
        Refunded
    }

    /**
     * @dev The SafeERC20 library is used to safely handle ERC20 operations to prevent issues with non-standard ERC20 tokens, for example, USDT.
     * @notice This means for every IERC20 token, we can now call the safeTransfer, safeTransferFrom, and safeApprove functions provided by the SafeERC20 library.
     */
    using SafeERC20 for IERC20;

    /// @dev The Lock struct represents a lock in the escrow contract, containing information about the payer, supplier, amount, deadline, and status of the lock.
    struct Lock {
        address payer;
        address supplier;
        uint256 amount;
        uint64 deadline; //@GambogeSplash question: why did you specifically use uint64?
        Status status;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    /// @dev The token variable is an instance of the IERC20 interface, representing the ERC20 token used for the escrow contract. 
    IERC20 public immutable token;
    /// @dev The attester variable is the address of the inspector authorised to attest shipment proof.
    address public attester;
    // address public owner; // @GambogeSplash This is already defined in the Ownable contract, so it is redundant.

    // @dev The locks mapping stores the locks in the escrow contract, with the corridorId as the key and the Lock struct as the value.
    mapping(bytes32 corridorId => Lock) public locks;

    // uint256 private _guard = 1;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    /// @notice The Locked event is emitted when a lock is created in the escrow contract, containing information about the corridorId, payer, supplier, amount, and deadline of the lock.
    event Locked(
        bytes32 indexed corridorId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline
    );
    /// @notice The Released event is emitted when funds are released to the supplier in the escrow contract, containing information about the corridorId, supplier, amount, and proof reference.
    event Released(bytes32 indexed corridorId, address indexed supplier, uint256 amount, string proofRef);
    /// @notice The Refunded event is emitted when funds are refunded to the payer in the escrow contract, containing information about the corridorId, payer, and amount.
    event Refunded(bytes32 indexed corridorId, address indexed payer, uint256 amount);
    /// @notice The AttesterChanged event is emitted when the attester address is changed in the escrow contract, containing information about the new attester address.
    event AttesterChanged(address indexed attester);

    // modifier nonReentrant() {
    //     require(_guard == 1, "reentrant");
    //     _guard = 2;
    //     _;
    //     _guard = 1;
    // } //@GambogeSplash This modifier is now redundant, contract now uses the OZ import instead.

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address token_, address attester_) Ownable(msg.sender) {
        if (token_ == address(0)) {
            revert DhowEscrow__InvalidToken();
        }
        if (attester_ == address(0)) {
            revert DhowEscrow__InvalidAttesterAddress();
        }
        token = IERC20(token_);
        attester = attester_;
        // owner = msg.sender; // @GambogeSplash This is already set in the Ownable constructor, so is redundant.
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setAttester(address attester_) external onlyOwner {
     _setAttester(attester_);
    }

    /// @notice Lock funds for a corridor. Payer must have approved this contract.
    function lock(bytes32 corridorId, address supplier, uint256 amount, uint64 deadline) external nonReentrant {
        require(locks[corridorId].status == Status.None, "exists");
        if (supplier == address(0)) {
            revert DhowEscrow__InvalidSupplierAddress();
        }
        if (amount == 0) {
            revert DhowEscrow__InvalidAmount();
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);


        locks[corridorId] =
            Lock({payer: msg.sender, supplier: supplier, amount: amount, deadline: deadline, status: Status.Locked});

        emit Locked(corridorId, msg.sender, supplier, amount, deadline);
    }

    /// @notice Attest the shipment proof and release funds to the supplier.
    function attestRelease(bytes32 corridorId, string calldata proofRef) external nonReentrant {
        if (msg.sender != attester) {
            revert DhowEscrow__NotAttester();
        }
        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) {
            revert DhowEscrow__StatusNotLocked();
        }

        l.status = Status.Released;

        IERC20(token).safeTransfer(l.supplier, l.amount);



        emit Released(corridorId, l.supplier, l.amount, proofRef);
    }

    /// @notice Refund the payer after the deadline if no proof was attested.
    function refund(bytes32 corridorId) external nonReentrant {
        Lock storage l = locks[corridorId];
        if (l.status != Status.Locked) {
            revert DhowEscrow__StatusNotLocked();
        }
        if (block.timestamp <= l.deadline) {
            revert DhowEscrow__DeadlineNotPassed();
        }

        l.status = Status.Refunded;

        IERC20(token).safeTransfer(l.payer, l.amount);

        emit Refunded(corridorId, l.payer, l.amount);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function _setAttester(address attester_) internal {
        // require(msg.sender == owner, "not owner"); @GambogeSplash This check is now redundant, as the onlyOwner modifier already ensures that only the owner(contract deployer) can call this function.
        if (attester_ == address(0)) {
            revert DhowEscrow__InvalidAttesterAddress();
        }
        attester = attester_;
        emit AttesterChanged(attester_);
    }

    /*//////////////////////////////////////////////////////////////
                      EXTERNAL VIEW/PURE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function getLock(bytes32 corridorId) external view returns (Lock memory) {
        return locks[corridorId];
    }
}
