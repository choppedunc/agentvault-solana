import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as bs58 from "bs58";
import { config } from "./config";
import idl from "../../../target/idl/agent_vault.json";

export function getConnection(): Connection {
  return new Connection(config.rpcUrl, "confirmed");
}

export function getAgentKeypair(): Keypair {
  return Keypair.fromSecretKey(bs58.default.decode(config.agentPrivateKey));
}

export function getVaultAddress(): PublicKey {
  return new PublicKey(config.vaultAddress);
}

export function getProgramId(): PublicKey {
  return new PublicKey(config.programId);
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
