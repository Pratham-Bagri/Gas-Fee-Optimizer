require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

// We define the exact struct tuple in the ABI so Ethers knows how to encode the JavaScript object
const BATCH_ABI = [
    "function balances(address) view returns (uint256)",
    "function nonces(address) view returns (uint256)",
    "function executeBatch(tuple(address user, address designatedRelayer, address[] targets, bytes[] payloads, uint256[] values, uint256 nonce, uint256 deadline, bytes signature) batch) external"
];

const batchContract = new ethers.Contract(CONTRACT_ADDRESS, BATCH_ABI, relayerWallet);

// testing
app.get('/test', (req, res) => {
    res.json({ message: "working fine" });
});

// --- THE RELAYER ENDPOINT ---
app.post('/relay', async (req, res) => {
    try {
        const { batch } = req.body;
        console.log(`\n📥 Received batch request from user: ${batch.user}`);
        console.log(`🔢 Actions in queue: ${batch.targets.length}`);

        // Calculate Total Native ETH Value Required
        let totalValueRequired = 0n;
        for (const val of batch.values) {
            totalValueRequired += BigInt(val);
        }

        // Fetch User's Escrow Balance
        const userBalance = await batchContract.balances(batch.user);
        
        console.log(`📊 User Escrow Balance: ${ethers.formatEther(userBalance)} ETH`);
        console.log(`💸 Batch Values sum: ${ethers.formatEther(totalValueRequired)} ETH`);

        if (userBalance < totalValueRequired) {
            const errMsg = `Insufficient escrow balance. Need at least ${ethers.formatEther(totalValueRequired)} ETH just for the transaction values.`;
            console.log(`❌ Rejected: ${errMsg}`);
            return res.status(400).json({ success: false, error: errMsg });
        }

        // Gas Estimation (Simulate the transaction)
        let estimatedGas;
        try {
            console.log(`⚙️  Simulating transaction execution...`);
            // This will instantly throw an error if the signature is bad or a transaction reverts
            estimatedGas = await batchContract.executeBatch.estimateGas(batch);
        } catch (simError) {
            console.log(`❌ Rejected: Transaction simulation failed.`);
            return res.status(400).json({ 
                success: false, 
                error: "Transaction simulation failed. Check your inputs, ensure you have enough balance, or verify the target contract accepts the call." 
            });
        }

        // Calculate Sponsorship Fee
        const feeData = await provider.getFeeData();
        const currentGasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("10", "gwei");
        
        // Calculate the user fee (bufferedGas * gasPrice * (100-SponsorshipPercentage))
        const userGasFeeLimit = (estimatedGas * currentGasPrice * 0n) / 100n; //FULL SPONSORSHIP

        const absoluteTotalRequired = totalValueRequired + userGasFeeLimit;

        console.log(`Estimated User Gas Fee (80%): ~${ethers.formatEther(userGasFeeLimit)} ETH`);
        console.log(`Total Required (Value + Gas): ~${ethers.formatEther(absoluteTotalRequired)} ETH`);

        if (userBalance < absoluteTotalRequired) {
            const errMsg = `Insufficient balance to cover transactions + 80% gas sponsorship. Need ~${ethers.formatEther(absoluteTotalRequired)} ETH.`;
            console.log(`Rejected: ${errMsg}`);
            return res.status(400).json({ success: false, error: errMsg });
        }

        // Submit to the Sepolia Network
        console.log(`Submitting to Sepolia network...`);
        
        const tx = await batchContract.executeBatch(batch);
        console.log(`Transaction submitted! Waiting for network... Hash: ${tx.hash}`);
        
        // Respond to the frontend immediately so the UI can show the loading spinner and Tx Hash
        res.status(200).json({ success: true, txHash: tx.hash });

        // Wait for the block to be mined to log it on the server side
        const receipt = await tx.wait();
        console.log(`Transaction mined in block ${receipt.blockNumber}! Gas Used: ${receipt.gasUsed.toString()}`);

    } catch (error) {
        console.error("Relay failed:", error);
        res.status(500).json({ success: false, error: error.message || "Internal server error during relay." });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`Relayer Node Active on port ${PORT}`);
    console.log(`Designated Relayer: ${relayerWallet.address}`);
    console.log(`===========================================`);
});