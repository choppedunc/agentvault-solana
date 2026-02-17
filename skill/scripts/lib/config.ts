import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || "",
  vaultAddress: process.env.VAULT_ADDRESS || "",
  rpcUrl: process.env.RPC_URL || "https://api.devnet.solana.com",
  programId: process.env.PROGRAM_ID || "6L2hon3xSV9saeaGG7cgFG298JGW4vf9jDtF5xg8E6pZ",
};

export function validateConfig() {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  if (!config.vaultAddress) throw new Error("VAULT_ADDRESS not set");
}
