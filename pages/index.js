import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
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
import AdminDashboard from "./AdminDashboard";
import UserDashboard from "./UserDashboard";

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



export default function Home(){
  const {connection} =useConnection();
  const wallet = useWallet();
  const [loading,setLoading]= useState(false);
  const [isAdmin,setIsAdmin]= useState(false);
  const [icoData,setIcoData]= useState(null );
  const [amount,setAmount]= useState("");
  const [userTokenBalance,setUserTokenBalance]= useState(null);

  useEffect(()=>{
    fetchIcoData(); // Fetch ICO data regardless of wallet connection
    if (wallet.connected){
      checkIfAdmin();
      fetchUserTokenBalance();
    }
  },[wallet.connected]);
  const getProgram =()=>{
    if (!wallet.connected) return null;
    const provider = new AnchorProvider(connection,wallet,{
    commitment:"confirmed",
  });
  return new Program(IDL,PROGRAM_ID,provider);
  };
  const checkIfAdmin = async ()=> {
    try{
      const program =getProgram();
      if (!program) return;

      const [dataPda]= PublicKey.findProgramAddressSync(
        [Buffer.from("data"), wallet.publicKey.toBuffer()],
        program.programId
      );
      try{
        const data = await program.account.data.fetch(dataPda);
        setIsAdmin(data.admin.equals(wallet.publicKey));

      }catch(error){
        const accounts = await program.account.data.all();
        if(accounts.length==0){
          setIsAdmin(true);
        }
        else {
          setIsAdmin(false);
          setIcoData(accounts[0].account);
        }
      }
    }catch(error){
      console.log("Error checking admin:",error);
      setIsAdmin(false);
    }
  };
  const  fetchIcoData = async ()=>{
    try {
      let program;
      if (wallet.connected) {
        program = getProgram();
      } else {
        // Create a read-only provider for fetching data without wallet
        const provider = new AnchorProvider(connection, null, { commitment: "confirmed" });
        program = new Program(IDL, PROGRAM_ID, provider);
      }
      if(!program) return;
      const accounts =await program.account.data.all();
      if(accounts.length>0){
        setIcoData(accounts[0].account);
      }
    }catch(error) {

      console.log("Error fetching Ico data",error)
    }
  };
  const createIcoAta =async  ()=>{

    try{
      if (!amount || parseInt(amount)<=0){
        alert("please enter a valid amount");
      }
      setLoading(true);
      const program = getProgram();
      if(!program) return;
      
      const [icoAtaPda] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"),wallet.publicKey.toBuffer()],
        program.programId
      );
      const adminIcoAta =await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );
      await program.methods.createIcoAta(new BN(amount)).accounts({
        icoAtaForIcoProgram : icoAtaPda,
        data : dataPda,
        icoMint :ICO_MINT,
        icoAtaForAdmin : adminIcoAta,
        admin : wallet.publicKey,
        systemProgram : SystemProgram.programId,
        tokenprogram : TOKEN_PROGRAM_ID,
        rent : SYSVAR_RENT_PUBKEY,
      })
      .rpc();
      alert("Ico initialised Sucessfully!");
    }catch(error){
      console.log("Error inisialising Ico",error);
      alert(`Error:${error.message}`);
    } finally{
      setLoading(false);
    }
  };
  const depositeIco =async  ()=>{

    try{
      if (!amount || parseInt(amount)<=0){
        alert("please enter a valid amount");
      }
      setLoading(true);
      const program = getProgram();
      if(!program) return;
      
      const [icoAtaPda] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"),wallet.publicKey.toBuffer()],
        program.programId
      );
      const adminIcoAta =await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey
      );
      await program.methods.depositIcoInAta(new BN(amount)).accounts({
        icoAtaForIcoProgram : icoAtaPda,
        data : dataPda,
        icoMint :ICO_MINT,
        icoAtaForAdmin : adminIcoAta,
        admin : wallet.publicKey,
        tokenprogram : TOKEN_PROGRAM_ID,
        
      })
      .rpc();
      alert("Token Deposited Sucessfully!");
    }catch(error){
      console.log("Error inisialising Ico",error);
      alert(`Error:${error.message}`);
    } finally{
      setLoading(false);
    }
  };
  const buyTokens =async  ()=>{

    try{
      if (!amount || parseInt(amount)<=0){
        alert("please enter a valid amount");
      }
      if (!icoData || !icoData.admin) { // <-- FIX: check for icoData and admin
      alert("ICO data not loaded. Please wait or refresh.");
      return;
    }
      setLoading(true);
      const program = getProgram();
      if(!program) return;

      const solCost = parseInt(amount)*0.001;
      const balance = await connection.getBalance(wallet.publicKey);
      if(balance <solCost*1e9 +5000) {
        alert(`Insufficient balance. Need ${solCost.toFixed(3)} Sol plus fee`);
        return;
      }
      
      const [icoAtaPda,bump] = await PublicKey.findProgramAddressSync(
        [ICO_MINT.toBuffer()],
        program.programId
      );
      const [dataPda] = await PublicKey.findProgramAddress(
        [Buffer.from("data"),icoData.admin.toBuffer()],
        program.programId
      );
      const userIcoAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey,
      );
      try{
        await getAccount(connection,userIcoAta);
      }catch(error){
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userIcoAta,
          wallet.publicKey,
          ICO_MINT,
        );
        const transaction = new Transaction().add(createAtaIx);
        await wallet.sendTransaction(transaction,connection);
        await new Promise ((resolve)=> setTimeout(resolve,2000)); 
      }
      await program.methods.buyToken(bump,new BN(amount)).accounts({
        icoAtaForIcoProgram : icoAtaPda,
        data : dataPda,
        icoMint :ICO_MINT,
        icoAtaForUser : userIcoAta,
        user : wallet.publicKey,
        admin : icoData.admin,
        tokenprogram : TOKEN_PROGRAM_ID,
        systemProgram:SystemProgram.programId,
      })
      .rpc();
      alert(` Sucessfully purchased ${amount} token!`);
      await fetchIcoData();
      await fetchUserTokenBalance();
    }catch(error){
      console.log("Error buying",error);
      alert(`Error:${error.message}`);
    } finally{
      setLoading(false);
    }
  };
  const fetchUserTokenBalance = async ()=>{
    try{
      if (!wallet.connected) return;
      const userAta = await getAssociatedTokenAddress(
        ICO_MINT,
        wallet.publicKey,
      
      );
      try{
        const tokenAccount = await getAccount(connection,userAta);
        setUserTokenBalance(tokenAccount.amount.toString());

      }catch(error){
        console.log(error);
        setUserTokenBalance('0');
      }
    }catch(error){
      console.log("Error fetching token balance",error);
      setUserTokenBalance('0');
    }
  };
  // If user is admin, show the admin dashboard
  if (wallet.connected && isAdmin) {
    return (
      <AdminDashboard
        icoData={icoData}
        onDataUpdate={() => {
          fetchIcoData();
          fetchUserTokenBalance();
        }}
      />
    );
  }

  // If user is connected but not admin, show user dashboard
  if (wallet.connected && !isAdmin) {
    return (
      <UserDashboard
        icoData={icoData}
        onDataUpdate={() => {
          fetchIcoData();
          fetchUserTokenBalance();
        }}
      />
    );
  }

  // If not connected, show connect wallet button
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-700 p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-dark-100">Welcome to the ICO DApp</h1>

      {/* ICO Information Section */}
      {icoData && (
        <div className="max-w-4xl w-full mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Token Supply */}
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
                    {icoData.totalTokens ? icoData.totalTokens.toString() : "0"}
                  </p>
                </div>
              </div>
            </div>

            {/* Tokens Available */}
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Available</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                    {icoData.totalTokens && icoData.tokenSold ? (icoData.totalTokens - icoData.tokenSold).toString() : "0"}
                  </p>
                </div>
              </div>
            </div>

            {/* Tokens Sold */}
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Sold</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                    {icoData.tokenSold ? icoData.tokenSold.toString() : "0"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ICO Details Section */}
      <div className="max-w-2xl w-full mb-8 bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-dark-100">ICO Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Network</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">Solana</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Entity</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">Solana ICO Platform</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Token Price</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">0.001 SOL per token</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Minimum Purchase</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-dark-100">1 token</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-600 dark:text-dark-400 mb-2">Token Name</p>
          <p className="text-gray-700 dark:text-dark-300 text-sm font-semibold">
            Rajat
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4">
        <WalletMultiButton className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" />
        {!wallet.connected && (
          <p className="text-gray-700 dark:text-dark-300 text-center">
            Please connect your wallet to continue.
          </p>
        )}
      </div>
    </div>
  );
}

  
