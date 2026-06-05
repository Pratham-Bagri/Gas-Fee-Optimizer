
# Gasless Meta Transaction Executor

A full-stack Web3 system that enables **gasless batched Ethereum transactions** using **EIP-712 signatures** and a **relayer architecture**.

Users sign transactions **off-chain**, and a relayer submits them **on-chain**, allowing interaction with smart contracts **without directly paying gas fees**.

This project demonstrates how meta-transactions improve **user experience in decentralized applications** by separating **transaction authorization** from **transaction execution**.

---

# Overview

The **Gasless Meta Transaction Executor** is built as a complete meta-transaction infrastructure consisting of:

- A **smart contract** responsible for verifying signatures and executing batched transactions
- A **relayer backend** that validates signed payloads and broadcasts transactions
- A **React frontend** that allows users to build and sign transaction batches

The system runs on the **Ethereum Sepolia testnet** and showcases a production-style architecture used in modern Web3 applications.

---

# Repository Structure

```

contracts/   Smart contract source code
backend/     Node.js relayer API
frontend/    React client application
tests/       Scripts for testing and experimentation

````

Each component is designed to operate independently but integrates together to provide a complete gasless transaction workflow.

---

# System Architecture

The project follows a **meta-transaction workflow**:

1. The user constructs a batch of contract calls using the frontend interface.
2. The frontend encodes these calls and generates an **EIP-712 typed signature**.
3. The signed payload is sent to the **relayer backend**.
4. The relayer validates the request and simulates the transaction.
5. The relayer broadcasts the transaction to the blockchain.
6. The smart contract verifies the signature and executes the batch.

This architecture allows users to interact with smart contracts **without directly paying gas**, while still maintaining strong cryptographic security.

---

# Smart Contract

The core contract (`Web3AssamBatchExecutor`) provides:

- **EIP-712 signature verification**
- **Batch execution of multiple contract calls**
- **Replay protection using nonces**
- **User escrow balance management**
- **Gas sponsorship logic**

Users deposit ETH into the contract escrow, which can be used during transaction execution.

---

# Relayer Backend

The backend is a **Node.js + Express service** responsible for submitting transactions to the blockchain.

Main responsibilities:

- Receive signed batches from clients
- Verify escrow balances on-chain
- Simulate execution using `estimateGas`
- Broadcast valid transactions
- Return the transaction hash immediately

This allows the frontend to remain responsive while confirmations happen asynchronously.

---

# Frontend Application

The frontend is built using **React + Vite** and provides the user interface for interacting with the system.

Features include:

- MetaMask wallet connection
- Dynamic contract ABI fetching
- Transaction batch builder
- Function parameter encoding
- EIP-712 signature generation
- Relayer submission

The frontend guides users through creating and signing batches of contract interactions.

---

# Technology Stack

**Smart Contracts**
- Solidity
- OpenZeppelin libraries

**Backend**
- Node.js
- Express
- Ethers.js v6

**Frontend**
- React
- Vite
- Ethers.js

**Network**
- Ethereum Sepolia Testnet

---

# Getting Started

## 1. Deploy the Smart Contract

Deploy the batch executor contract using your preferred Solidity framework (Hardhat, Foundry, etc.).

Save the deployed contract address for backend and frontend configuration.

---

## 2. Run the Relayer Backend

```bash
cd backend
npm install
````

Create a `.env` file:

```
PORT=3001
RPC_URL=your_rpc_endpoint
RELAYER_PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=deployed_contract_address
```

Start the relayer:

```bash
npm run start
```

---

## 3. Run the Frontend

```bash
cd frontend
npm install
```

Create a `.env` file:

```
VITE_RELAYER_API_URL=http://localhost:3001/relay
```

Start the development server:

```bash
npm run dev
```

Make sure MetaMask is connected to the **Sepolia network**.
Ensure the Relayer Wallet holds sepoliaETH.

---

# Testing

The `tests` directory contains scripts for experimenting with batching behavior and comparing gas costs.

Create a `.env` file:

```

RPC_URL=your_rpc_endpoint
RELAYER_PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=deployed_contract_address
```


Run tests using:

```bash
cd tests
npm install
npm run start
```

---

# Security Considerations

* **Nonce-based replay protection**
* **Deadline validation for signed batches**
* **EIP-712 signature verification**
* **Transaction simulation before execution**
* Relayer cannot modify transaction data without invalidating the signature

---

# License

MIT License


