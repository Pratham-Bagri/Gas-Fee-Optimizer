# Kriti Web3 Batch Transaction App

## 📌 Overview

This project is a **Web3 batch transaction application** that allows a user to queue multiple smart contract interactions and execute them in a single blockchain transaction via a relayer.

It consists of two main parts:

* **Frontend (React + Vite)** → User interface for selecting contracts and batching calls
* **Backend Relayer (Node.js + Express + Ethers.js)** → Submits transactions on behalf of users and pays gas

---

## 🚀 Key Features

* Connect wallet using browser provider (e.g., MetaMask)
* Fetch smart contract ABI dynamically (via Etherscan API)
* Identify callable (write) functions
* Queue multiple contract calls
* Batch execution of transactions
* Gasless UX using relayer

---

## 🏗️ Project Structure

```
Kriti-Web3-main/
│
├── src/                     # Frontend source code (React)
│   ├── App.jsx             # Main application logic
│   ├── main.jsx            # Entry point
│   └── assets/             # Static assets
│
├── relayer-backend/        # Backend relayer service
│   ├── server.js           # Express server + relay logic
│   └── .env                # Environment variables
│
├── public/                 # Public assets
├── index.html              # HTML template
├── package.json            # Frontend dependencies
└── vite.config.js          # Vite configuration
```

---

## ⚙️ Tech Stack

### Frontend

* React 19
* Vite
* Ethers.js v6

### Backend

* Node.js
* Express.js
* Ethers.js
* dotenv

---

## 🔄 How It Works

### Step 1: Wallet Connection

User connects their wallet using `window.ethereum`.

### Step 2: Contract Input

User enters a contract address → App fetches ABI from Etherscan.

### Step 3: Function Selection

App parses ABI and extracts **write functions**.

### Step 4: Queue Transactions

User selects functions, fills inputs, and adds them to a batch queue.

### Step 5: Signing

User signs the batch data off-chain.

### Step 6: Relayer Submission

Frontend sends request to backend `/relay` endpoint.

### Step 7: Execution

Relayer:

1. Gets user nonce from contract
2. Calls `executeBatch(...)`
3. Pays gas fees
4. Returns transaction hash

---

## 🔐 Smart Contract Interaction

The backend interacts with a deployed contract that exposes:

```
executeBatch(address user, address[] targets, bytes[] payloads, uint256[] values, bytes signature)
nonces(address user)
```

---

## 🛠️ Installation & Setup

### 1. Clone the Repository

```
git clone <repo-url>
cd Kriti-Web3-main
```

### 2. Install Frontend Dependencies

```
npm install
```

### 3. Setup Backend

```
cd relayer-backend
npm install
```

Create a `.env` file:

```
RPC_URL=<your_rpc_url>
RELAYER_PRIVATE_KEY=<your_private_key>
BATCH_CONTRACT_ADDRESS=<contract_address>
```

---

## ▶️ Running the Project

### Start Backend

```
cd relayer-backend
node server.js
```

Runs on: `http://localhost:3001`

### Start Frontend

```
npm run dev
```

Runs on: `http://localhost:5173`

---

## 🌐 Environment Configuration

In `App.jsx`:

* `ETHERSCAN_API_KEY` → Required for ABI fetching
* `CHAIN_ID` → Currently set to Sepolia (11155111)
* `RELAYER_URL` → Backend endpoint

---

## ⚠️ Important Notes

* Never expose your relayer private key publicly
* Ensure correct network (Sepolia/Mainnet)
* Contract must support batch execution logic
* Nonce validation is minimal → needs improvement for production

---

## 🧪 Possible Improvements

* Add nonce validation before submission
* UI enhancements (better UX for batching)
* Error handling and retry logic
* Support multiple networks
* Add transaction history
* Deploy backend to cloud (AWS/Render)

---

## 📌 Use Cases

* Gas optimization
* DeFi batch operations
* DAO voting actions
* NFT minting batches

---

## 📄 Conclusion

This project demonstrates a **gas-abstracted Web3 interaction model** using a relayer and batch execution. It is a strong foundation for building advanced dApps with improved user experience.

---

## 👨‍💻 Author Notes

This is a development/demo-level project and should be extended with security and validation before production use.
