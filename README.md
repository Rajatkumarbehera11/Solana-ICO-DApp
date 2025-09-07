# Solana ICO DApp

A simple decentralized application (DApp) for managing an Initial Coin Offering (ICO) on the Solana blockchain.  
Users can initialize an ICO, deposit tokens, and buy tokens using their Solana wallet.

## Features

- **Admin:**  
  - Initialize the ICO  
  - Deposit tokens to the ICO pool  
  - Buy tokens

- **User:**  
  - Buy tokens from the ICO

- **Wallet Integration:**  
  - Connect using Solana wallet (Phantom, Solflare, etc.)

## Technologies

- [Next.js](https://nextjs.org/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [@project-serum/anchor](https://project-serum.github.io/anchor/)
- [@solana/wallet-adapter](https://github.com/solana-labs/wallet-adapter)
- [@solana/spl-token](https://spl.solana.com/token)

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- Yarn or npm
- Solana wallet (Phantom, Solflare, etc.)
- Solana CLI (for deploying smart contracts)

### Installation

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd <your-repo-folder>
   ```

2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables:**

 add Your Solana program id and token adress in .env.local:

   ```
   NEXT_PUBLIC_PROGRAM_ID=<Your_Solana_Program_ID>
   NEXT_PUBLIC_ICO_MINT=<Your_ICO_Mint_Address>
   ```

4. **Add your IDL file:**

   Place your `idl.json` file in `lib/idl.json`.

### Running the App

```sh
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect your wallet** using the wallet button.
2. **Admin:**  
   - If ICO is not initialized, enter the token amount and click "Initialize ICO".
   - Deposit tokens to the ICO pool.
   - Buy tokens.
3. **User:**  
   - Enter the amount of tokens to buy and click "Buy Token".

## Project Structure

- `pages/index.js` — Main DApp UI and logic
- `lib/idl.json` — Anchor IDL for your Solana program
- `Contract/SolanaCo.rs`- Solana Contract

## Contact

For any queries or support, please contact the developer:

**Name:** Rajat  
**Email:** [rajatkumarbehera2003@gmail.com](mailto:rajatkumarbehera2003@gmail.com)


"# Solana-ICO-DApp" 
"# Solana-ICO-DApp" 
"# Solana-ICO-DApp" 
"# Solana-ICO-DApp" 
