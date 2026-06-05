import React, { useState } from "react";
import { BrowserProvider, Contract, AbiCoder, keccak256, parseEther, formatEther, Interface } from "ethers";
import './App.css';

// --- CONSTANTS ---
const BATCH_EXECUTOR_ADDRESS = "0x22947AE6BE4E5feC398D44Cf674981ff7c8d088e";
const DESIGNATED_RELAYER_ADDRESS = "0x7de3F13F6de05cee16a3B5Dde1B73EebF178484a";
const SEPOLIA_CHAIN_ID = 11155111n; 
const SEPOLIA_HEX_ID = "0xaa36a7"; 
const RELAYER_API_URL = import.meta.env.VITE_RELAYER_API_URL;
const ETHERSCAN_API_KEY = "75SRJMT5VE2CKI82CUUATHQGU8IDAWM4KG";

const BATCH_ABI = [
  "function nonces(address) view returns (uint256)",
  "function balances(address) view returns (uint256)",
  "function deposit() external payable",
  "function withdraw(uint256 amount) external"
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  const [userBalance, setUserBalance] = useState("0");
  
  // Funding State
  const [depositAmount, setDepositAmount] = useState(""); 
  const [withdrawAmount, setWithdrawAmount] = useState(""); 
  
  // Dynamic Contract Builder State
  const [inputTarget, setInputTarget] = useState("");
  const [fetchedFunctions, setFetchedFunctions] = useState([]);
  const [selectedFuncIndex, setSelectedFuncIndex] = useState("");
  const [funcParams, setFuncParams] = useState({}); 
  const [inputValue, setInputValue] = useState(""); 
  
  // Queue & App Status State
  const [txQueue, setTxQueue] = useState([]);
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- CONNECT & AUTOMATIC NETWORK SWITCH ---
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        setStatus("Switching network to Sepolia...");
        try {
          await browserProvider.send("wallet_switchEthereumChain", [{ chainId: SEPOLIA_HEX_ID }]);
        } catch (switchError) {
          setStatus("Please switch to Sepolia in MetaMask manually.");
          return;
        }
      }

      const updatedProvider = new BrowserProvider(window.ethereum);
      const userSigner = await updatedProvider.getSigner();
      const address = await userSigner.getAddress();

      setProvider(updatedProvider);
      setSigner(userSigner);
      setUserAddress(address);
      setStatus("Connected to Sepolia!");
      
      fetchBalance(updatedProvider, address);
    } catch (err) {
      console.error(err);
      setStatus("Connection failed.");
    }
  };

  const fetchBalance = async (currentProvider, address) => {
    try {
      const contract = new Contract(BATCH_EXECUTOR_ADDRESS, BATCH_ABI, currentProvider);
      const balanceWei = await contract.balances(address);
      setUserBalance(formatEther(balanceWei));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  };

  // --- 2. DEPOSIT & WITHDRAW ---
  const handleDeposit = async () => {
    if (!signer) return alert("Please connect wallet first!");
    if (!depositAmount || isNaN(depositAmount) || Number(depositAmount) <= 0) return alert("Enter a valid ETH amount.");

    try {
      setStatus("Initiating deposit in MetaMask...");
      const contract = new Contract(BATCH_EXECUTOR_ADDRESS, BATCH_ABI, signer);
      const tx = await contract.deposit({ value: parseEther(depositAmount) });
      setStatus(`Waiting for confirmation... TX: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      setStatus("Deposit Successful!");
      setDepositAmount(""); 
      fetchBalance(provider, userAddress);
    } catch (err) {
      console.error(err);
      setStatus("Deposit Failed.");
    }
  };

  const handleWithdraw = async () => {
    if (!signer) return alert("Please connect wallet first!");
    if (!withdrawAmount || isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) return alert("Enter a valid ETH amount.");

    try {
      setStatus("Initiating withdrawal in MetaMask...");
      const contract = new Contract(BATCH_EXECUTOR_ADDRESS, BATCH_ABI, signer);
      const tx = await contract.withdraw(parseEther(withdrawAmount));
      setStatus(`Waiting for confirmation... TX: ${tx.hash.substring(0, 10)}...`);
      await tx.wait();
      setStatus("Withdrawal Successful!");
      setWithdrawAmount(""); 
      fetchBalance(provider, userAddress);
    } catch (err) {
      console.error(err);
      setStatus("Withdrawal Failed.");
    }
  };

  // --- 3. FETCH DYNAMIC CONTRACT ABI ---
  const fetchContractFunctions = async () => {
    if (!inputTarget) return alert("Enter a contract address first.");
    setStatus("Fetching contract from Etherscan...");
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=${SEPOLIA_CHAIN_ID}&module=contract&action=getabi&address=${inputTarget}&apikey=${ETHERSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "1") {
        const abi = JSON.parse(data.result);
        const writeFunctions = abi.filter(item => item.type === "function" && item.stateMutability !== "view" && item.stateMutability !== "pure");
        setFetchedFunctions(writeFunctions);
        setSelectedFuncIndex("");
        setFuncParams({});
        setStatus(`Found ${writeFunctions.length} write functions!`);
      } else {
        setStatus("ABI not verified on Etherscan.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to fetch ABI.");
    }
  };

  const handleParamChange = (index, value) => setFuncParams(prev => ({ ...prev, [index]: value }));

  // --- 4. AUTO-ENCODE AND ADD TO QUEUE ---
  const addToQueue = () => {
    if (!inputTarget || selectedFuncIndex === "") return alert("Select a function first!");
    const selectedFunc = fetchedFunctions[selectedFuncIndex];
    const args = selectedFunc.inputs.map((input, idx) => funcParams[idx] || "");
    
    try {
      const iface = new Interface([selectedFunc]);
      const encodedData = iface.encodeFunctionData(selectedFunc.name, args);
      const newTx = {
        target: inputTarget,
        value: inputValue ? parseEther(inputValue).toString() : "0",
        data: encodedData,
        displayValue: inputValue || "0",
        funcName: selectedFunc.name 
      };

      setTxQueue([...txQueue, newTx]);
      setInputValue("");
      setSelectedFuncIndex("");
      setFuncParams({});
      setStatus(`Added ${selectedFunc.name} to batch queue!`);
    } catch (err) {
      console.error(err);
      alert(`Error encoding data.\n${err.message}`);
    }
  };

  const clearQueue = () => setTxQueue([]);

  // --- 5. SIGN & EXECUTE GASLESS BATCH ---
  const signAndSubmitBatch = async () => {
      if (txQueue.length === 0) return alert("Queue is empty!");
      if (!signer) return alert("Please connect wallet first!");

      try {
        setIsProcessing(true);
        setStatus("Generating cryptographic hash...");
        
        const targets = txQueue.map(tx => tx.target);
        const payloads = txQueue.map(tx => tx.data);
        const values = txQueue.map(tx => tx.value);

        const abiCoder = new AbiCoder();
        const encodedBatchData = abiCoder.encode(["address[]", "bytes[]", "uint256[]"], [targets, payloads, values]);
        const batchHash = keccak256(encodedBatchData);

        const contract = new Contract(BATCH_EXECUTOR_ADDRESS, BATCH_ABI, provider);
        const currentNonce = await contract.nonces(userAddress);
        const nonce = currentNonce.toString(); 

        const deadline = Math.floor(Date.now() / 1000) + 3600; 

        const domain = { name: "Batcher", version: "1", chainId: SEPOLIA_CHAIN_ID, verifyingContract: BATCH_EXECUTOR_ADDRESS };
        const types = { Batch: [ { name: "user", type: "address" }, { name: "designatedRelayer", type: "address" }, { name: "batchHash", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" } ] };
        
        const batchPayload = {
          user: userAddress,
          designatedRelayer: DESIGNATED_RELAYER_ADDRESS,
          batchHash: batchHash,
          nonce: nonce,
          deadline: deadline
        };

        setStatus("Please sign the batch in MetaMask...");
        const signature = await signer.signTypedData(domain, types, batchPayload);

        const fullRelayPayload = { ...batchPayload, targets, payloads, values, signature };

        setStatus("Signature acquired! Sending to Relayer...");
        const response = await fetch(RELAYER_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch: fullRelayPayload })
        });

        const result = await response.json();
        if (result.success) {
          setStatus(`Success! Tx Hash: ${result.txHash}`);
          clearQueue();
          fetchBalance(provider, userAddress); 
        } else {
          setStatus(`Relayer Error: ${result.error}`);
        }
      } catch (err) {
        console.error(err);
        setStatus(`Error: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
  };

  // --- UI RENDER ---
  return (
    <div className="app-container">
      
      {/* 1. TOP NAVBAR */}
      <header className="header">
        <h1 className="header-title">Meta-Transaction Executor</h1>
        <div className="header-actions">
          {status && <span className="status-badge">{status}</span>}
          {!userAddress ? (
            <button className="btn-connect" onClick={connectWallet}>Connect MetaMask</button>
          ) : (
            <div className="account-pill">
              <span style={{ color: "#10b981", fontWeight: "bold" }}>
                {userBalance} <span style={{ fontSize: "0.8em", color: "#a1a1aa" }}>ETH</span>
              </span>
              <span style={{ color: "#3f3f46" }}>|</span>
              <span style={{ fontFamily: "monospace", color: "#e4e4e7" }}>
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 2. MAIN DASHBOARD GRID */}
      <main className="main-grid">
        
        {/* LEFT COLUMN */}
        <div className="left-column">
          
          {/* Escrow Card */}
          <div className="card">
            <h3 className="card-title">Deposit/Withdraw From Balance (Costs User Gas)</h3>
            <div className="escrow-row">
              <div className="escrow-input-group">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={depositAmount} 
                  onChange={e => setDepositAmount(e.target.value)} 
                  className="escrow-input"
                />
                <button onClick={handleDeposit} className="btn-deposit">Deposit</button>
              </div>
              <div className="escrow-input-group">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={withdrawAmount} 
                  onChange={e => setWithdrawAmount(e.target.value)} 
                  className="escrow-input"
                />
                <button onClick={handleWithdraw} className="btn-withdraw">Withdraw</button>
              </div>
            </div>
          </div>

          {/* Builder Card */}
          <div className="card builder-card">
            <h3 className="card-title">Build Meta-Transaction</h3>
            <div className="builder-top-row">
              <input 
                type="text" 
                placeholder="Contract Address (0x...)" 
                value={inputTarget} 
                onChange={e => setInputTarget(e.target.value)} 
                className="input-target" 
              />
              <button onClick={fetchContractFunctions} className="btn-fetch">Fetch Transactions</button>
            </div>
            
            <div className="builder-content">
              {fetchedFunctions.length > 0 && (
                <div className="builder-form">
                  <select 
                    value={selectedFuncIndex} 
                    onChange={e => setSelectedFuncIndex(e.target.value)} 
                    className="select-field"
                  >
                    <option value="">-- Select Function --</option>
                    {fetchedFunctions.map((func, index) => (
                      <option key={index} value={index}>{func.name}</option>
                    ))}
                  </select>
                  
                  {selectedFuncIndex !== "" && (
                    <div className="param-inputs">
                      {fetchedFunctions[selectedFuncIndex].inputs.map((input, idx) => (
                        <input 
                          key={idx} 
                          type="text" 
                          placeholder={`${input.name} (${input.type})`} 
                          value={funcParams[idx] || ""} 
                          onChange={e => handleParamChange(idx, e.target.value)} 
                          className="input-param" 
                        />
                      ))}
                      {fetchedFunctions[selectedFuncIndex].stateMutability === "payable" && (
                        <input 
                          type="number" 
                          placeholder="ETH Value (e.g., 0.1)" 
                          value={inputValue} 
                          onChange={e => setInputValue(e.target.value)} 
                          className="input-param input-eth" 
                        />
                      )}
                      <button onClick={addToQueue} className="btn-add-queue">+ Add to Queue</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="queue-column">
          <h3 className="queue-header">
            <span>Batch Queue</span>
            <span className="queue-count">{txQueue.length} actions</span>
          </h3>
          
          <div className="queue-list-container">
            {txQueue.length === 0 ? (
              <div className="empty-queue">
                <p>Your batch is empty</p>
              </div>
            ) : (
              <ul className="queue-list">
                {txQueue.map((tx, index) => (
                  <li key={index} className="queue-item">
                    <div className="queue-item-header">
                      <span className="queue-item-name">{index + 1}. {tx.funcName}</span>
                      <span className="queue-item-value">{tx.displayValue} ETH</span>
                    </div>
                    <span className="queue-item-target">To: {tx.target}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="queue-actions">
            <button 
              onClick={signAndSubmitBatch} 
              disabled={isProcessing || txQueue.length === 0} 
              className={`btn-execute ${isProcessing ? 'processing' : ''}`}
            >
              {isProcessing ? (
                <>
                  <svg className="spinner-svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  Executing...
                </>
              ) : "Sign & Execute (Gassless)"}
            </button>
            <button onClick={clearQueue} className="btn-clear">Clear</button>
          </div>
        </div>
      </main>
    </div>
  );
}