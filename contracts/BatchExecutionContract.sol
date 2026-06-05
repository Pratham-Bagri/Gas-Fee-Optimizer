// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Web3AssamBatchExecutor is EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    error ArrayLengthMismatch();
    error SignatureExpired();
    error InvalidSignature();
    error InvalidNonce();
    error InsufficientBalance();
    error BatchExecutionFailed(uint256 index);
    error TransferFailed();
    error InvalidRelayer();

    struct BatchPayload {
        address user;
        address designatedRelayer;
        address[] targets;
        bytes[] payloads;
        uint256[] values;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }


    mapping(address => uint256) public balances;
    
    mapping(address => uint256) public nonces; 

    // PERCENTAGE OF GAS PAID BY USER
    uint256 public userGasPercentage = 0; //FULL SPONSORSHIP(CAN BE CHANGED FOR PARTIAL SPONSORSHIP)
    
    // Constant overhead for the base transaction cost and signature verification
    uint256 private constant GAS_OVERHEAD = 45000;

    bytes32 private constant BATCH_TYPEHASH = keccak256(
        "Batch(address user,address designatedRelayer,bytes32 batchHash,uint256 nonce,uint256 deadline)"
    );

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event BatchExecuted(address indexed user, uint256 gasCharged);

    constructor() EIP712("Batcher", "1") {}

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(msg.sender, amount);
    }

    function executeBatch(BatchPayload calldata batch) external nonReentrant { 
        // START GAS TRACKER
        uint256 startGas = gasleft();

        // CONTRACT MUST BE CALLED BY THE DESIGNATED RELAYER ONLY
        if (msg.sender != batch.designatedRelayer) revert InvalidRelayer();

        // CHECK IF THE SIGNATURE EXPIRED
        if (block.timestamp > batch.deadline) revert SignatureExpired();
        
        // SEQUENTIAL NONCE CHECK
        if (batch.nonce != nonces[batch.user]) revert InvalidNonce();
        
        uint256 length = batch.targets.length;
        if (length != batch.payloads.length || length != batch.values.length) revert ArrayLengthMismatch();

        // SIGNATURE VERIFICATION
        bytes32 batchHash = keccak256(abi.encode(batch.targets, batch.payloads, batch.values));
        bytes32 structHash = keccak256(abi.encode(
            BATCH_TYPEHASH,
            batch.user,
            batch.designatedRelayer,
            batchHash,
            batch.nonce,
            batch.deadline
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(batch.signature);
        if (signer != batch.user) revert InvalidSignature();

        // INCREMENT SEQUENTIAL NONCE
        nonces[batch.user]++;

        // TRACK TOTAL VALUE SENT
        uint256 totalValueTransferred = 0;

        // EXECUTE BATCH, REVERT ENTIRE BATCH IF ONE TRANSACTION FAILS
        for (uint256 i = 0; i < length; i++) {
            totalValueTransferred += batch.values[i];
            
            (bool success, ) = batch.targets[i].call{value: batch.values[i]}(batch.payloads[i]);
            if (!success) revert BatchExecutionFailed(i);
        }

        // CALCULATE GAS SPONSORSHIP
        uint256 gasUsed = startGas - gasleft() + GAS_OVERHEAD;
        uint256 totalGasCost = gasUsed * tx.gasprice;
        uint256 userGasCost = (totalGasCost * userGasPercentage) / 100;

        // CALCULATE TOTAL DEDUCTION (Gas + Value Sent)
        uint256 totalDeduction = totalValueTransferred + userGasCost;

        // REVERT IF USER CANNOT AFFORD BOTH
        if (balances[batch.user] < totalDeduction) revert InsufficientBalance();
        
        // DEDUCT FROM USER
        balances[batch.user] -= totalDeduction;         
        
        // CREDIT THE RELAYER (Only for the gas they paid, the value already left the contract)
        balances[msg.sender] += userGasCost;          

        emit BatchExecuted(batch.user, userGasCost);
    }
}