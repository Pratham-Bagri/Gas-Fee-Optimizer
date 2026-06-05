import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract, Interface, isAddress } from 'ethers';
// Add this to the top of App.jsx
import * as ethers from 'ethers';

// --- CONFIGURATION ---
// Get a free key from https://etherscan.io/myapikey
const ETHERSCAN_API_KEY = "75SRJMT5VE2CKI82CUUATHQGU8IDAWM4KG"; 
// Change to "api-sepolia" or "api" for mainnet
const ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api"; 
const CHAIN_ID = 11155111;

const RELAYER_URL = "http://localhost:3001/relay";

export default function App() {
  // --- STATE ---
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState("");
  
  // App Logic State
  const [targetContract, setTargetContract] = useState("");
  const [contractABI, setContractABI] = useState(null);
  const [writeFunctions, setWriteFunctions] = useState([]);
  const [batchQueue, setBatchQueue] = useState([]);
  
  // Modal State
  const [selectedFunc, setSelectedFunc] = useState(null);
  const [formInputs, setFormInputs] = useState({});
  const [status, setStatus] = useState("");

  // --- WALLET CONNECTION ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new BrowserProvider(window.ethereum);
        const _signer = await _provider.getSigner();
        const _address = await _signer.getAddress();
        setProvider(_provider);
        setSigner(_signer);
        setUserAddress(_address);
      } catch (err) {
        console.error("User rejected connection", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // --- 1. FETCH ABI ---
  const fetchABI = async () => {
    if (!isAddress(targetContract)) {
      setStatus("Invalid Contract Address");
      return;
    }
    setStatus("Fetching ABI...");

    try {
      const url = `${ETHERSCAN_BASE_URL}?chainid=${CHAIN_ID}&module=contract&action=getabi&address=${targetContract}&apikey=${ETHERSCAN_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "1") {
        const parsedABI = JSON.parse(data.result);
        setContractABI(parsedABI);
        
        // Filter for Write Functions (not view/pure)
        const iface = new Interface(parsedABI);
        const funcs = [];
        iface.forEachFunction((f) => {
          if (f.stateMutability !== "view" && f.stateMutability !== "pure") {
            funcs.push(f);
          }
        });
        setWriteFunctions(funcs);
        setStatus("ABI Loaded Successfully!");
      } else {
        setStatus("Error: " + data.result);
      }
    } catch (err) {
      setStatus("Fetch Error: " + err.message);
    }
  };

  // --- 2. HANDLE INPUT CHANGES ---
  const handleInputChange = (argName, value) => {
    setFormInputs(prev => ({ ...prev, [argName]: value }));
  };

  // --- 3. ADD TO QUEUE (ENCODING) ---
  const addToBatch = () => {
    try {
      if (!selectedFunc || !contractABI) return;

      const iface = new Interface(contractABI);
      
      // Map form inputs to the function's expected arguments order
      const args = selectedFunc.inputs.map(input => formInputs[input.name]);
      
      // ENCODE THE DATA
      const encodedData = iface.encodeFunctionData(selectedFunc.name, args);

      // Add to Queue
      setBatchQueue(prev => [...prev, {
        to: targetContract,
        funcName: selectedFunc.name,
        args: args,
        data: encodedData,
        value: 0 // Defaulting 0 ETH value for simplicity
      }]);

      // Reset Modal
      setSelectedFunc(null);
      setFormInputs({});
      setStatus("Added to Batch!");
    } catch (err) {
      alert("Error encoding data: " + err.message);
    }
  };

  // --- 4. EXECUTE (SIGNING) ---
  const signAndExecuteBatch = async () => {
    if (!signer || batchQueue.length === 0) return;
    setStatus("Signing...");

    const readProvider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/355fad37773742ea917ba064df53bc62");
  
  // 2. Attach the readProvider instead of the MetaMask provider
  const batchContract = new Contract(
    "0xc5525D3F6410A7E988FcDCD4F243A5887c81A258",
    ["function nonces(address) view returns (uint256)"],
    readProvider // <--- USE YOUR DEDICATED PROVIDER HERE
  );

  

    try {

    let currentNonce;
    setStatus("Fetching Nonce...");
    
    // --- NEW DEBUG LOGS ---
    const network = await readProvider.getNetwork();
    console.log("1. Connected Network Chain ID:", network.chainId); // Sepolia is 11155111
    console.log("2. Target Contract:", "0xc5525D3F6410A7E988FcDCD4F243A5887c81A258");
    console.log("3. User Address:", userAddress);
    // ----------------------

    currentNonce = await batchContract.nonces(userAddress);
    console.log("✅ Success! Current Nonce:", currentNonce.toString());
    
  

    setStatus("Signing...");
    
    // 2. Construct Message Hash Arguments
    // Must match Solidity: abi.encodePacked(user, targets, payloads, values, nonce)
    const targets = batchQueue.map(tx => tx.to);
    const payloads = batchQueue.map(tx => tx.data);
    const values = batchQueue.map(tx => 0); // Assuming 0 ETH value

    // 3. Sign Message (EIP-191 "Ethereum Signed Message")
    // Note: To match Solidity's abi.encodePacked, we need to hash it first in JS
    // OR use a library. For Hackathon speed, let's use a simpler signing method:
    // We will sign the HASH of the data.
    
    const abiCoder = new ethers.AbiCoder();
    
    // This perfectly matches Solidity's abi.encode()
    const encodedData = abiCoder.encode(
        ["address", "address[]", "bytes[]", "uint256[]", "uint256"],
        [userAddress, targets, payloads, values, currentNonce]
    );
    
    const messageHash = ethers.keccak256(encodedData);
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    // 4. Send to Relayer
    setStatus("Sending to Relayer...");
    const response = await fetch(RELAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: userAddress,
        targets,
        payloads,
        values,
        signature
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`Success! TX Hash: ${result.txHash}`);
      setBatchQueue([]);
      setStatus("Batch Executed!");
    } else {
      alert("Relayer Error: " + result.error);
      setStatus("Failed");
    }

  } catch (err) {
    console.error(err);
    setStatus("Error: " + err.message);
  }
};

const removeFromBatch = (indexToRemove) => {
    setBatchQueue(prevQueue => prevQueue.filter((_, index) => index !== indexToRemove));
  };



  // --- RENDER HELPERS ---
  const openModal = (funcFragment) => {
    setSelectedFunc(funcFragment);
    setFormInputs({});
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>⚡ Web3Assam Gas Optimizer</h1>
        {!userAddress ? (
          <button style={styles.button} onClick={connectWallet}>Connect Wallet</button>
        ) : (
          <span style={styles.address}>Connected: {userAddress.slice(0,6)}...{userAddress.slice(-4)}</span>
        )}
      </header>

      <div style={styles.mainGrid}>
        {/* LEFT COLUMN: SETUP & FUNCTIONS */}
        <div style={styles.column}>
          <div style={styles.card}>
            <h3>1. Import Contract</h3>
            <div style={styles.inputGroup}>
              <input 
                style={styles.input}
                placeholder="Contract Address (0x...)" 
                value={targetContract}
                onChange={(e) => setTargetContract(e.target.value)}
              />
              <button style={styles.buttonSecondary} onClick={fetchABI}>Load ABI</button>
            </div>
            <small style={{color: '#666'}}>{status}</small>
          </div>

          {writeFunctions.length > 0 && (
            <div style={styles.card}>
              <h3>2. Select Function</h3>
              <div style={styles.gridButtons}>
                {writeFunctions.map((fn, i) => (
                  <button key={i} style={styles.funcButton} onClick={() => openModal(fn)}>
                    {fn.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: BATCH QUEUE */}
        <div style={styles.column}>
          <div style={styles.card}>
            <h3>3. Transaction Batch ({batchQueue.length})</h3>
            {batchQueue.length === 0 ? (
              <p style={{color: '#888', fontStyle: 'italic'}}>Queue is empty.</p>
            ) : (
              <ul style={styles.list}>
                {batchQueue.map((item, idx) => (
                  <li key={idx} style={styles.listItem}>
                    {/* Flex container to push the button to the right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      
                      {/* Left Side: Transaction Details */}
                      <div>
                        <div style={{fontWeight: 'bold'}}>{idx + 1}. {item.funcName}</div>
                        <div style={{fontSize: '12px'}}>To: {item.to.slice(0,6)}...{item.to.slice(-4)}</div>
                        <div style={{fontSize: '10px', color: '#666', marginTop: '4px'}}>
                          Data: {item.data.slice(0, 20)}...
                        </div>
                      </div>

                      {/* Right Side: Delete Button */}
                      <button 
                        style={styles.deleteBtn} 
                        onClick={() => removeFromBatch(idx)}
                        title="Remove transaction"
                      >
                        ❌
                      </button>

                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            {batchQueue.length > 0 && (
              <button style={styles.executeBtn} onClick={signAndExecuteBatch}>
                ✍️ Sign & Execute Batch
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PARAMETER MODAL */}
      {selectedFunc && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>Configure: {selectedFunc.name}</h3>
            {selectedFunc.inputs.map((input, idx) => (
              <div key={idx} style={{marginBottom: '10px'}}>
                <label style={styles.label}>{input.name} ({input.type})</label>
                <input
                  style={styles.input}
                  placeholder={`Value for ${input.name}`}
                  onChange={(e) => handleInputChange(input.name, e.target.value)}
                />
              </div>
            ))}
            <div style={styles.modalActions}>
              <button style={styles.buttonSecondary} onClick={() => setSelectedFunc(null)}>Cancel</button>
              <button style={styles.button} onClick={addToBatch}>Add to Queue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- BASIC STYLES (Inline for Copy-Paste ease) ---
const styles = {
  container: { fontFamily: 'sans-serif', width: '100%', minHeight: '100vh', margin: '0', padding: '20px', backgroundColor: '#e6e6e6',boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between',color:'white', alignItems: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #ddd' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', maxWidth:'1600px',margin:'0 auto' },
  column: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { background: 'white',color:"grey ", padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  inputGroup: { display: 'flex', gap: '10px', marginBottom: '10px' },
  input: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' },
  button: { background: '#4F46E5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  buttonSecondary: { background: '#4F46E5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  executeBtn: { width: '100%', marginTop: '20px', background: '#059669', color: 'white', border: 'none', padding: '15px', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' },
  funcButton: { background: '#DBEAFE', color: '#1E40AF', border: '1px solid #93C5FD', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' },
  gridButtons: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  list: { listStyle: 'none', padding: 0 },
  listItem: { background: '#F3F4F6', padding: '10px', marginBottom: '8px', borderRadius: '6px', borderLeft: '4px solid #4F46E5' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modal: { background: 'white', padding: '30px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9rem', color: '#333' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
  address: { background: '#eee', padding: '8px 12px', borderRadius: '20px', fontSize: '0.9rem' },
  deleteBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px 5px', opacity: '0.7', transition: 'opacity 0.2s' },
};