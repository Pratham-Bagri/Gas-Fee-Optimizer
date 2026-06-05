# Relayer API Service

This backend service acts as a transaction relayer for the meta-transaction system.
It receives signed batches from the frontend, verifies them, and broadcasts them
to the blockchain.

## Features

- Gas-sponsored transaction submission
- On-chain escrow balance verification
- Transaction simulation using gas estimation
- Asynchronous transaction broadcasting

---

## Prerequisites

- Node.js (v18+)
- npm

---

## Installation

Clone the repository and install dependencies:

npm install

---

## Environment Configuration

Create a `.env` file in the backend directory:

PORT=3001  
RPC_URL=https://your-rpc-url.com  
RELAYER_PRIVATE_KEY=your_private_key  
CONTRACT_ADDRESS=0xYourContractAddress

---

## Running the Server

Development:

npm run start

Production:

node relayer.js

---

## API Endpoints

### Health Check

GET /test

Response:

{
  "message": "working fine"
}

---

### Submit Transaction Batch

POST /relay

Headers:

Content-Type: application/json

Body:

- batch
- user
- designatedRelayer
- targets
- payloads
- values
- nonce
- deadline
- signature

Success response:

{
  "success": true,
  "txHash": "0x..."
}

Error responses:

{
  "success": false,
  "error": "Insufficient escrow balance"
}

{
  "success": false,
  "error": "Transaction simulation failed"
}