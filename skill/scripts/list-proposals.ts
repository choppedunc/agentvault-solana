import { getProgram, getVaultAddress, getProgramId } from "./lib/client";
import { validateConfig } from "./lib/config";
import { formatUsdc } from "./lib/format";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  const filter = process.argv[2] || "pending";

  validateConfig();
  const program = getProgram();
  const vaultAddress = getVaultAddress();
  const programId = getProgramId();

  const vault = await (program.account as any).vault.fetch(vaultAddress);
  const proposalCount = Number(vault.proposalCount);

  const proposals: any[] = [];
  for (let i = 0; i < proposalCount; i++) {
    const id = new BN(i);
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vaultAddress.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
      programId
    );

    try {
      const proposal = await (program.account as any).proposal.fetch(proposalPda);
      const status = proposal.executed ? "executed" : proposal.cancelled ? "cancelled" : "pending";

      if (filter !== "all" && status !== filter) continue;

      proposals.push({
        id: i,
        recipient: proposal.recipient.toBase58(),
        amount: formatUsdc(proposal.amount),
        status,
        memo: proposal.memo,
        proposedAt: new Date(Number(proposal.proposedAt) * 1000).toISOString(),
      });
    } catch {
      // Proposal account closed (rent reclaimed)
    }
  }

  console.log(JSON.stringify({ filter, proposals }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
