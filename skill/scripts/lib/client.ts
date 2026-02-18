import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../idl/tandem_wallet.json"), "utf-8"));

export function getConnection(): Connection {
  return new Connection(config.rpcUrl, "confirmed");
}

export function getAgentKeypair(): Keypair {
  return Keypair.fromSecretKey(bs58.decode(config.agentPrivateKey));
}

export function getVaultAddress(): PublicKey {
  return new PublicKey(config.vaultAddress);
}

export function getProgramId(): PublicKey {
  return new PublicKey(config.programId);
}

export function getProtocolConfigAddress(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_config")],
    getProgramId()
  );
  return pda;
}

export function getStakeAccountAddress(staker: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), staker.toBuffer()],
    getProgramId()
  );
  return pda;
}

export function getProgram() {
  const connection = getConnection();
  const agentKeypair = getAgentKeypair();
  const wallet = new Wallet(agentKeypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as any, provider);
}
