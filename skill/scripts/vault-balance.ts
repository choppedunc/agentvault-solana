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

  console.log(JSON.stringify({
    usdc: formatUsdc(usdcBalance.amount),
    sol: formatSol(solBalance),
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
