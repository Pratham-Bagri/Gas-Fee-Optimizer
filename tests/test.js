require("dotenv").config();
const { ethers } = require("ethers");

const EXECUTOR_ADDRESS = "0x22947AE6BE4E5feC398D44Cf674981ff7c8d088e";
const TARGET_ADDRESS = "0x1BD5f8E475fC96db9dB3767dd999fb0C2067D986"; 

const RPC_URL = process.env.RPC_URL;
const USER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY; // FOR TESTING LETS TREAT THE RELAYER AS THE USER ALSO
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY; 

// CHANGE THIS ABI IF YOU WANT TO TEST WITH A DIFFERENT CONTRACT
const TARGET_ABI = ["function doSomething() external"];
const EXECUTOR_ABI = [
    "function nonces(address) view returns (uint256)",
    "function executeBatch(tuple(address user, address designatedRelayer, address[] targets, bytes[] payloads, uint256[] values, uint256 nonce, uint256 deadline, bytes signature) batch) external"
];

async function runGasTest() {
    console.log("=======================================================");
    console.log("INITIATING PURE NODE.JS LIVE SEPOLIA GAS TEST");
    console.log("=======================================================\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const userWallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
    const network = await provider.getNetwork();

    console.log(`User Wallet: ${userWallet.address}`);
    console.log(`Relayer Wallet: ${relayerWallet.address}\n`);

    const targetContractUser = new ethers.Contract(TARGET_ADDRESS, TARGET_ABI, userWallet);
    const executorContractRelayer = new ethers.Contract(EXECUTOR_ADDRESS, EXECUTOR_ABI, relayerWallet);

    // The raw hex payload for the function we want to call(CHANGGE THIS WHEN THE TEST CONTRACT IS CHANGED)
    const iface = new ethers.Interface(TARGET_ABI);
    const payload = iface.encodeFunctionData("doSomething");

    // --- SCENARIO A: THE OLD WAY ---
    console.log("-------------------------------------------------------");
    console.log("SCENARIO A: THE OLD WAY (10 Individual Transactions)");
    console.log("-------------------------------------------------------");
    
    let oldWayTotalGas = 0n;
    for (let i = 0; i < 10; i++) {
        process.stdout.write(`   Executing Tx ${i + 1}/10... `);
        // User sends the transaction directly to the target contract
        const tx = await targetContractUser.doSomething();
        const receipt = await tx.wait(); // Wait for Sepolia block confirmation
        oldWayTotalGas += receipt.gasUsed;
        console.log(`Mined! Gas: ${receipt.gasUsed.toString()}`);
    }
    console.log(`\nTOTAL GAS BURNED (OLD WAY): ${oldWayTotalGas.toString()}\n`);

    // --- SCENARIO B: THE WEB3ASSAM WAY ---
    console.log("-------------------------------------------------------");
    console.log("SCENARIO B: BATCHING THE TRANSACTIONS");
    console.log("-------------------------------------------------------");

    const targets = [TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS, TARGET_ADDRESS,];
    const payloads = [payload, payload, payload, payload, payload, payload, payload, payload, payload, payload];
    const values = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

    // Off-chain Array Hashing
    const abiCoder = new ethers.AbiCoder();
    const encodedBatchData = abiCoder.encode(["address[]", "bytes[]", "uint256[]"], [targets, payloads, values]);
    const batchHash = ethers.keccak256(encodedBatchData);

    // Fetch Nonce & Timeline
    const nonce = await executorContractRelayer.nonces(userWallet.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // EIP-712 Signature (Off-chain)
    const domain = { name: "Batcher", version: "1", chainId: network.chainId, verifyingContract: EXECUTOR_ADDRESS };
    const types = { Batch: [ { name: "user", type: "address" }, { name: "designatedRelayer", type: "address" }, { name: "batchHash", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" } ] };
    const message = { user: userWallet.address, designatedRelayer: relayerWallet.address, batchHash: batchHash, nonce: nonce, deadline: deadline };
    
    process.stdout.write(`   User signing intent off-chain... `);
    const signature = await userWallet.signTypedData(domain, types, message);
    console.log(`Done!`);

    // Relayer submits the batch
    const batchPayload = { user: userWallet.address, designatedRelayer: relayerWallet.address, targets, payloads, values, nonce, deadline, signature };
    
    process.stdout.write(`   Relayer submitting batched transaction to Sepolia... `);
    const batchTx = await executorContractRelayer.executeBatch(batchPayload);
    const batchReceipt = await batchTx.wait();
    const newWayTotalGas = batchReceipt.gasUsed;
    
    console.log(`Mined!`);
    console.log(`\nTOTAL GAS BURNED (NEW WAY): ${newWayTotalGas.toString()}\n`);

    // --- THE RESULTS ---
    const gasSaved = oldWayTotalGas - newWayTotalGas;
    const percentageSaved = (Number(gasSaved) / Number(oldWayTotalGas)) * 100;

    console.log("=======================================================");
    console.log(" LIVE SEPOLIA NETWORK RESULTS");
    console.log("=======================================================");
    console.log(`TOTAL GAS SAVED: ${gasSaved.toString()} units`);
    console.log(`EFFICIENCY GAIN: ${percentageSaved.toFixed(2)}% cheaper`);
    console.log("=======================================================\n");
}

runGasTest().catch(console.error);