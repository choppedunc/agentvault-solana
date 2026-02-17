import { getProgram, getVaultAddress, getProgramId } from "./lib/client";
import { validateConfig } from "./lib/config";
import { formatUsdc } from "./lib/format";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  const proposalId = process.argv[2];
  if (!proposalId) {
    console.error(JSON.stringify({ error: "Usage: get-proposal.ts <proposal_id>" }));
    process.exit(1);
  }

  validateConfig();
  const program = getProgram();
  const vaultAddress = getVaultAddress();
  const programId = getProgramId();

  const id = new BN(parseInt(proposalId));
  const [proposalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), vaultAddress.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId
  );

  const proposal = await (program.account as any).proposal.fetch(proposalPda);
  const status = proposal.executed ? "executed" : proposal.cancelled ? "cancelled" : "pending";

  console.log(JSON.stringify({
    id: parseInt(proposalId),
    vault: proposal.vault.toBase58(),
    recipient: proposal.recipient.toBase58(),
    recipientAta: proposal.recipientAta.toBase58(),
    amount: formatUsdc(proposal.amount),
    status,
    memo: proposal.memo,
    proposedAt: new Date(Number(proposal.proposedAt) * 1000).toISOString(),
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
