import React, { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import IDL from "../lib/idl.json";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
  }
);

const ENV_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID;
const ENV_ICO_MINT = process.env.NEXT_PUBLIC_ICO_MINT;

const PROGRAM_ID = new PublicKey(ENV_PROGRAM_ID);
const ICO_MINT = new PublicKey(ENV_ICO_MINT);
const TOKEN_DECIMALS = new BN(1_000_000_000);

export default function UserDashboard({ icoData, onDataUpdate }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [userTokenBalance, setUserTokenBalance] = useState(null);

  useEffect(() => {
    if (wallet.connected) {
      fetchUserTokenBalance();
    }
  }, [wallet.connected]);

  const getProgram = () => {
    if (!wallet.connected) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(IDL, PROGRAM_ID, provider);
  };

  const fetchUserTokenBalance = async () => {
    try {
      if (!wallet.connected) return;
      const userAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );
      try {
        const tokenAccount = await getAccount(connection, userAta);
        setUserTokenBalance(tokenAccount.amount.toString());
      } catch (error) {
        setUserTokenBalance("0");
      }
    } catch (error) {
      console.log("Error fetching token balance", error);
      setUserTokenBalance("0");
    }
  };

  const buyTokens = async () => {
    try {
      if (!amount || parseInt(amount) <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      if (!icoData || !icoData.admin) {
        alert("ICO data not loaded. Please wait or refresh.");
        return;
      }
      setLoading(true);
      const program = getProgram();
      if (!program) return;

      const solCost = parseInt(amount) * 0.001;
      const balance = await connection.getBalance(wallet.publicKey);
      if (balance < solCost * 1e9 + 5000) {
        alert(`Insufficient balance. Need ${solCost.toFixed(3)} SOL plus fee`);
        return;
      }

      const [icoAtaPda, bump] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"), icoData.admin.toBuffer()],
        program.programId
      );
      const userIcoAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );

      try {
        await getAccount(connection, userIcoAta);
      } catch (error) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userIcoAta,
          wallet.publicKey,
          ICO_MINT
        );
        const transaction = new Transaction().add(createAtaIx);
        await wallet.sendTransaction(transaction, connection);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      await program.methods
        .buyToken(bump, new BN(amount))
        .accounts({
          icoAtaForIcoProgram: icoAtaPda,
          data: dataPda,
          icoMint: ICO_MINT,
          icoAtaForUser: userIcoAta,
          user: wallet.publicKey,
          admin: icoData.admin,
          tokenprogram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      alert(`Successfully purchased ${amount} tokens!`);
      onDataUpdate();
      await fetchUserTokenBalance();
    } catch (error) {
      console.log("Error buying tokens", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 shadow-lg border-b border-gray-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-100">ICO Token Sale</h1>
              <p className="text-gray-600 dark:text-dark-400 mt-1">Purchase tokens and join the ICO</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end space-x-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-dark-400">Connected Wallet</p>
                  <p className="text-xs text-gray-400 dark:text-dark-500 font-mono">
                    {wallet.publicKey?.toString().slice(0, 8)}...
                    {wallet.publicKey?.toString().slice(-8)}
                  </p>
                </div>
                <WalletMultiButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Total Supply</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                  {icoData ? icoData.totalTokens.toString() : "0"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Tokens Sold</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                  {icoData ? icoData.tokenSold.toString() : "0"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Available</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                  {icoData ? (icoData.totalTokens - icoData.tokenSold).toString() : "0"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Your Balance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                  {userTokenBalance ? (Number(userTokenBalance) / 1e9).toFixed(2) : "0"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Token Purchase */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-dark-100">Purchase Tokens</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Token Purchase</h3>
                <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                  Enter the amount of tokens you want to purchase.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 p-2 text-sm border border-blue-300 dark:border-blue-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:text-dark-100"
                    min="1"
                    step="1"
                  />
                  <button
                    onClick={buyTokens}
                    disabled={loading || !amount}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                  >
                    {loading ? "..." : "Buy"}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg">
                <h3 className="text-sm font-medium text-gray-800 dark:text-dark-200 mb-2">Token Price</h3>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-dark-400">1 Token =</span>
                  <span className="font-semibold text-gray-900 dark:text-dark-100">0.001 SOL</span>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-lg">
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Network Fee</h3>
                <div className="flex justify-between items-center">
                  <span className="text-orange-600 dark:text-orange-300">Estimated fee:</span>
                  <span className="font-semibold text-orange-900 dark:text-orange-100">~0.000005 SOL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-dark-100">Information</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">ICO Status</h3>
                <p className="text-xs text-green-600 dark:text-green-300">
                  {icoData ? "ICO is active and accepting purchases" : "ICO data loading..."}
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">How to Purchase</h3>
                <ol className="text-xs text-blue-600 dark:text-blue-300 space-y-1">
                  <li>1. Enter the amount of tokens you want to buy</li>
                  <li>2. Click "Buy" to initiate the transaction</li>
                  <li>3. Confirm the transaction in your wallet</li>
                  <li>4. Tokens will be added to your balance</li>
                </ol>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Important Notes</h3>
                <ul className="text-xs text-yellow-600 dark:text-yellow-300 space-y-1">
                  <li>• Ensure you have enough SOL for the purchase</li>
                  <li>• Network fees will be added to your transaction</li>
                  <li>• Transactions are irreversible once confirmed</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
