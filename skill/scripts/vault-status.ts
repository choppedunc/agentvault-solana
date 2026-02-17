import { getProgram, getVaultAddress, getConnection } from "./lib/client";
import { formatUsdc, formatSol } from "./lib/format";
import { getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const program = getProgram();
  const connection = getConnection();
  const vaultAddress = getVaultAddress();

  const vault = await (program.account as any).vault.fetch(vaultAddress);
  const usdcBalance = await getAccount(connection, new PublicKey(vault.vaultUsdcAta));
  const solBalance = await connection.getBalance(vaultAddress);

  const result = {
    vault: vaultAddress.toBase58(),
    human: vault.human.toBase58(),
    agent: vault.agent.toBase58(),
    usdcMint: vault.usdcMint.toBase58(),
    tier1Max: formatUsdc(vault.tier1Max),
    tier2Max: formatUsdc(vault.tier2Max),
    paused: vault.paused,
    proposalCount: vault.proposalCount.toString(),
    usdcBalance: formatUsdc(usdcBalance.amount),
    solBalance: formatSol(solBalance),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
