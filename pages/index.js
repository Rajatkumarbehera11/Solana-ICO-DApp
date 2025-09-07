import React,{useState,useEffect} from "react";
import dynamic from "next/dynamic";
import { useWallet,useConnection } from "@solana/wallet-adapter-react";

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import{Program,AnchorProvider,web3,BN} from "@project-serum/anchor";
import{
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import IDL from"../lib/idl.json";
const WalletMultiButton = dynamic(
  ()=>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
    {
      ssr:false,
    }
)
const ENV_PROGRAM_ID= process.env.NEXT_PUBLIC_PROGRAM_ID;
const ENV_ICO_MINT = process.env.NEXT_PUBLIC_ICO_MINT;

const PROGRAM_ID = new PublicKey(ENV_PROGRAM_ID);
const ICO_MINT = new PublicKey(ENV_ICO_MINT);
const TOKEN_DECIMALS=new BN(1_000_000_000);



export default function Home(){
  const {connection} =useConnection();
  const wallet = useWallet();
  const [loading,setLoading]= useState(false);
  const [isAdmin,setIsAdmin]= useState(false);
  const [icoData,setIcoData]= useState(null );
  const [amount,setAmount]= useState("");
  const [userTokenBalance,setUserTokenBalance]= useState(null);

  useEffect(()=>{
    if (wallet.connected){
      checkIfAdmin();
      fetchIcoData();
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
      const program =getProgram();
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
  return (
    <div className="min-h-screen bg-gray-100 py-6 flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:round-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="pb-8">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Solana ICO DApp</h1>
                <WalletMultiButton />
              </div>
              {wallet.connected &&(
                <div className="mt-4 text-sm text-gray-600">
                  <p>
                    wallet:{wallet.publicKey.toString().slice(0,8)}...
                    {wallet.publicKey.toString().slice(-8)}
                  </p>
                  <p className="mt-1">
                    Status:<span className= {`font-semibold ${isAdmin ? "text-green-600":"text-blue-600"}`}>
                      {
                        isAdmin ? "Admin":"User"
                      }
                    </span>
                  </p>
                  <p className="mt-2 p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">
                      our Token Balance
                    </span>
                    <span classname="font-semibold">
                      {
                        userTokenBalance ?(Number(userTokenBalance)/ 1e9).toFixed(2):"0"
                      }
                      tokens
                    </span>
                  </p>
                </div>
              )}
            </div>
            {wallet.connected &&(
              <div className="py-8">
                { icoData ? (
                  <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h2 classname="text-lg font-semibold mb-3">
                      ICO Status
                    </h2>
                    <div className="grid grid-cols-2 gap4 text-sm">
                      <div>
                        <div className="text-gray-600">
                        Total supply
                        </div>
                        <p classname="font-medium">
                          {icoData.totalTokens.toString()}
                          tokens
                        </p>
                      </div>
                      <div>
                        <div className="text-gray-600">
                        Token Sold
                        </div>
                        <p classname="font-medium">
                          {icoData.tokenSold.toString()}
                          tokens
                        </p>
                      </div>
                      <div>
                        <div className="text-gray-600">
                        Token Price
                        </div>
                        <p classname="font-medium">
                          0.001 SOL
                        </p>
                      </div>
                      <div>
                        <div className="text-gray-600">
                        Available 
                        </div>
                        <p classname="font-medium">
                          {(icoData.totalTokens-icoData.tokenSold).toString()}
                          tokens
                        </p>
                      </div>
                      <div>
                        <div className="text-gray-600">
                        Your Balance
                        </div>
                        <p classname="font-medium">
                          {
                            userTokenBalance ? (Number(userTokenBalance)/1e9).toFixed(2):"0"
                          }
                          tokens
                          
                        </p>
                      </div>
                    </div>
                  </div>
                ) : ( 
                  isAdmin && (
                    <div className= "mb-8 p-4 bg-yellow-50 rounded-lg boeder border-yellow-200">
                      <p className="text-yellow-700">
                        Ico needs to be initialized
                      </p>
                    </div>
                  )
                )}
                <div className="space-y-4">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e)=> setAmount(e.target.value)} 
                    placeholder={
                      isAdmin 
                        ? icoData 
                          ? "Amounts of token to deposite" 
                          : "amount of tokens to initialize"
                        :"Amount of tokens to buy"  
                    }
                    className ="w-full p-3 border rounded-lg focus:right-2 focus:ring-blue-500 focus:border-l-blue-500" min = "1" step="1" 
                  />
                  {
                    amount &&  !isAdmin && (
                      <div className = "p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                        <div classname ="flex justify-between">
                          <span>Token Amount:</span>
                          <span className="font-medium"> {amount} Tokens </span>
                        </div>
                        <div classname ="flex justify-between">
                          <span>cost:</span>
                          <span className="font-medium"> {(parseInt(amount)*0.01).toFixed(3)} sol </span>
                        </div>
                        <div classname ="flex justify-between">
                          <span>Network Fee:</span>
                          <span className="font-medium"> 0.000005 Sol </span>
                        </div>
                        <div classname ="border-t pt-2 flex justify-between font-semibold">
                          <span>Total :</span>
                          <span className="font-medium"> {(parseInt(amount)*0.001+0.000005).toFixed(6)} sol </span>
                        </div>
                      </div>
                    ) 
                  }

                  {isAdmin ? (
                    <div className = "space-y3">
                      {!icoData &&(
                        <button onClick={createIcoAta} disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 trasition-colors">
                          {loading ? "initializing..": "initialize ICO"}
                        </button>
                      )}
                      {icoData &&(
                        <>
                          <button onClick={depositeIco} disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 trasition-colors mb-3">
                            {loading ? "Depositing..": "Deposte token"}
                          </button>
                          <button onClick={buyTokens} disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 trasition-colors">
                            {loading ? "processing..": "Buy token"}
                          </button>

                        </>
                      )}
                    </div>
                  ):(
                    <button onClick={buyTokens} disabled={loading} className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 trasition-colors">
                      {loading ? "processing..": "Buy Token"}
                    </button>
                  ) }
                  {loading&& (
                    <div className="text-center animate-pluse text-gray-600 "> processing transation... </div>
                  )}
                </div>
              </div>
            )}
            {!wallet.connected &&(
              <div className="py-8 text-center text-gray-600"> Please connect your wallet to continue </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
} 
