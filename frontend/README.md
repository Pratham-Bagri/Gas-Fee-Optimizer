# Meta-Transaction Frontend Client

This React application allows users to create and sign batched Ethereum
transactions which are executed by a relayer.

The app is configured to run on the **Sepolia Testnet**.

---

## Features

- MetaMask wallet integration
- Dynamic contract interaction
- Transaction batch builder
- EIP-712 signature generation
- Relayer submission

---

## Configuration

Network: Sepolia  
Chain ID: 11155111

Batch Executor Contract:
0x22947AE6BE4E5feC398D44Cf674981ff7c8d088e

Designated Relayer:
0x7de3F13F6de05cee16a3B5Dde1B73EebF178484a

Dependencies:

- React
- Vite
- Ethers.js v6

---

## Environment Variables

Create a `.env` file:

VITE_RELAYER_API_URL=http://localhost:3001/relay

---

## Installation

npm install

---

## Run Development Server

npm run dev

---

## How the Frontend Works

1. Connect MetaMask wallet.
2. Ensure the wallet is on the Sepolia network.
3. Build a batch of contract calls.
4. Encode function calls using the contract ABI.
5. Sign the batch using EIP-712 typed data.
6. Send the signed payload to the relayer.

---

## Security Notes

- Only verified contracts with public ABIs can be used.
- Nonces prevent replay attacks.
- The relayer cannot modify transaction data because it is signed.