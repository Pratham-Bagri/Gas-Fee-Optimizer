require('dotenv').config();
const express = require('express');
const { JsonRpcProvider, Wallet, Contract } = require('ethers');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow frontend to call us
app.use(express.json());

// --- CONFIGURATION ---
const provider = new JsonRpcProvider(process.env.RPC_URL);
const wallet = new Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

const CONTRACT_ABI = [
  "function executeBatch(address user, address[] targets, bytes[] payloads, uint256[] values, bytes signature) external",
  "function nonces(address user) view returns (uint256)"
];

const batchContract = new Contract(process.env.BATCH_CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// --- ENDPOINT ---
app.post('/relay', async (req, res) => {
  console.log("📩 Received Relay Request...");
  const { user, targets, payloads, values, signature } = req.body;

  try {
    // 1. Get current nonce from contract
    // (In a real app, you'd check this matches what user signed)
    const nonce = await batchContract.nonces(user);
    console.log(`Processing Nonce: ${nonce.toString()} for User: ${user}`);

    // 2. Submit Transaction
    // The 'wallet' (Relayer) signs this transaction and pays GAS
    const tx = await batchContract.executeBatch(user, targets, payloads, values, signature);
    
    console.log(`✅ Transaction Sent! Hash: ${tx.hash}`);

    // 3. Respond to Frontend
    res.json({ 
      success: true, 
      txHash: tx.hash,
      message: "Batch submitted to Relayer!" 
    });

  } catch (error) {
    console.error("❌ Relay Failed:", error.reason || error.message);
    res.status(500).json({ error: error.reason || "Transaction failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Relayer running at http://localhost:${PORT}`);
});