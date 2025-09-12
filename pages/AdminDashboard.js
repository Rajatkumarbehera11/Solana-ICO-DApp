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

const ENV_PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID;
const ENV_ICO_MINT = process.env.NEXT_PUBLIC_ICO_MINT;

if (!ENV_PROGRAM_ID || !ENV_ICO_MINT) {
  throw new Error("Environment variables NEXT_PUBLIC_PROGRAM_ID and NEXT_PUBLIC_ICO_MINT must be set");
}

const PROGRAM_ID = new PublicKey(ENV_PROGRAM_ID);
const ICO_MINT = new PublicKey(ENV_ICO_MINT);
const TOKEN_DECIMALS = new BN(1_000_000_000);

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
  }
);

export default function AdminDashboard({ icoData, onDataUpdate }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [quickActionAmount, setQuickActionAmount] = useState("");
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

  const createIcoAta = async () => {
    try {
      if (!amount || parseInt(amount) <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      setLoading(true);
      const program = getProgram();
      if (!program) return;

      const [icoAtaPda] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"), wallet.publicKey.toBuffer()],
        program.programId
      );
      const adminIcoAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );

      await program.methods
        .createIcoAta(new BN(amount))
        .accounts({
          icoAtaForIcoProgram: icoAtaPda,
          data: dataPda,
          icoMint: ICO_MINT,
          icoAtaForAdmin: adminIcoAta,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
          tokenprogram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      alert("ICO initialized successfully!");
      onDataUpdate();
      await fetchUserTokenBalance();
    } catch (error) {
      console.log("Error initializing ICO", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const depositIco = async () => {
    try {
      if (!amount || parseInt(amount) <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      setLoading(true);
      const program = getProgram();
      if (!program) return;

      const [icoAtaPda] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"), wallet.publicKey.toBuffer()],
        program.programId
      );
      const adminIcoAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );

      await program.methods
        .depositIcoInAta(new BN(amount))
        .accounts({
          icoAtaForIcoProgram: icoAtaPda,
          data: dataPda,
          icoMint: ICO_MINT,
          icoAtaForAdmin: adminIcoAta,
          admin: wallet.publicKey,
          tokenprogram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      alert("Tokens deposited successfully!");
      onDataUpdate();
      await fetchUserTokenBalance();
    } catch (error) {
      console.log("Error depositing ICO", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-100">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-dark-400 mt-1">Manage your ICO operations</p>
            </div>
          <div className="text-right">
              <div className="flex items-center justify-end space-x-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-dark-400">Connected as Admin</p>
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

        {/* Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ICO Management */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-dark-100">ICO Management</h2>
            </div>

            {!icoData ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    ICO needs to be initialized before you can manage it.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                    Initial Token Amount
                  </label>
                  <input
                    type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter token amount to initialize"
                  className="w-full p-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:bg-dark-800 dark:text-dark-100"
                  min="1"
                  step="1"
                  />
                  <button
                    onClick={createIcoAta}
                    disabled={loading || !amount}
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Initializing ICO...
                      </div>
                    ) : (
                      "Initialize ICO"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    ICO is active and ready for operations.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                    Deposit Token Amount
                  </label>
                  <input
                    type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter token amount to deposit"
                  className="w-full p-3 border border-gray-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:bg-dark-800 dark:text-dark-100"
                  min="1"
                  step="1"
                  />
                  <button
                    onClick={depositIco}
                    disabled={loading || !amount}
                    className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 font-medium"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Depositing Tokens...
                      </div>
                    ) : (
                      "Deposit Tokens"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-dark-100">Quick Actions</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Test Token Purchase</h3>
                <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                  As admin, you can test the token purchase functionality.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="number"
                  value={quickActionAmount}
                  onChange={(e) => setQuickActionAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 p-2 text-sm border border-blue-300 dark:border-blue-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-800 dark:text-dark-100"
                  min="1"
                  step="1"
                  />
                  <button
                    onClick={() => buyTokens(quickActionAmount)}
                    disabled={loading || !quickActionAmount}
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
        </div>
      </div>
    </div>
  );
}
