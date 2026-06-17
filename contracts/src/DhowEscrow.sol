// SPDX-License-Identifier: MIT
pragma solidity 0.8.24; //@GambogeSplash nitpick: use a pinned compiler version


import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
} 

/// @title DhowEscrow — Proof-Lock conditional settlement.
/// @notice Holds USDC for a corridor and releases to the supplier when the
///         shipment proof is attested. In production the attester check is an
///         EAS attestation; here it is an attester role. Buyer is refunded
///         after the deadline if no proof arrives.
contract DhowEscrow is Ownable, AccessControl, ReentrancyGuard {
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
    address public attester; // the inspector authorised to attest shipment proof
    // address public owner; // @GambogeSplash This is already defined in the Ownable contract, so is redundant.

    mapping(bytes32 => Lock) public locks;

    uint256 private _guard = 1;

    event Locked(bytes32 indexed corridorId, address indexed payer, address indexed supplier, uint256 amount, uint64 deadline);
    event Released(bytes32 indexed corridorId, address indexed supplier, uint256 amount, string proofRef);
    event Refunded(bytes32 indexed corridorId, address indexed payer, uint256 amount);
    event AttesterChanged(address indexed attester);

    // modifier nonReentrant() {
    //     require(_guard == 1, "reentrant");
    //     _guard = 2;
    //     _;
    //     _guard = 1;
    // } //@GambogeSplash This modifier is now redundant, contract now uses the OZ import instead.

    constructor(address token_, address attester_) Ownable(msg.sender) {
        token = IERC20(token_);
        attester = attester_;
        // owner = msg.sender; // @GambogeSplash This is already set in the Ownable constructor, so is redundant.
    }

    function setAttester(address attester_) external onlyOwner{
        // require(msg.sender == owner, "not owner"); @GambogeSplash This check is now redundant, as the onlyOwner modifier already ensures that only the owner can call this function.
        attester = attester_;
        emit AttesterChanged(attester_);
    }

    /// @notice Lock funds for a corridor. Payer must have approved this contract.
    function lock(bytes32 corridorId, address supplier, uint256 amount, uint64 deadline)
        external
        nonReentrant
    {
        require(locks[corridorId].status == Status.None, "exists");
        require(supplier != address(0), "supplier");
        require(amount > 0, "amount");
        require(token.transferFrom(msg.sender, address(this), amount), "pull failed");

        locks[corridorId] = Lock({
            payer: msg.sender,
            supplier: supplier,
            amount: amount,
            deadline: deadline,
            status: Status.Locked
        });

        emit Locked(corridorId, msg.sender, supplier, amount, deadline);
    }

    /// @notice Attest the shipment proof and release funds to the supplier.
    function attestRelease(bytes32 corridorId, string calldata proofRef)
        external
        nonReentrant
    {
        require(msg.sender == attester, "not attester");
        Lock storage l = locks[corridorId];
        require(l.status == Status.Locked, "not locked");

        l.status = Status.Released;
        require(token.transfer(l.supplier, l.amount), "release failed");

        emit Released(corridorId, l.supplier, l.amount, proofRef);
    }

    /// @notice Refund the payer after the deadline if no proof was attested.
    function refund(bytes32 corridorId) external nonReentrant {
        Lock storage l = locks[corridorId];
        require(l.status == Status.Locked, "not locked");
        require(block.timestamp > l.deadline, "not expired");

        l.status = Status.Refunded;
        require(token.transfer(l.payer, l.amount), "refund failed");

        emit Refunded(corridorId, l.payer, l.amount);
    }

    function getLock(bytes32 corridorId) external view returns (Lock memory) {
        return locks[corridorId];
    }
}
