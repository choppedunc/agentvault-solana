import { getProgram, getVaultAddress, getConnection, getAgentKeypair, getProgramId } from "./lib/client";
import { usdcToRaw, formatUsdc } from "./lib/format";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(JSON.stringify({ error: "Usage: send-usdc.ts <recipient> <amount> [--emergency]" }));
    process.exit(1);
  }

  const recipientAddress = new PublicKey(args[0]);
  const amount = parseFloat(args[1]);
  const isEmergency = args.includes("--emergency");
  const rawAmount = usdcToRaw(amount);
  const program = getProgram();
  const connection = getConnection();
  const vaultAddress = getVaultAddress();
  const agentKeypair = getAgentKeypair();
  const programId = getProgramId();

  const vault = await (program.account as any).vault.fetch(vaultAddress);

  // Get or create recipient ATA
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection, agentKeypair, new PublicKey(vault.usdcMint), recipientAddress
  );

  // Check whitelist
  const [whitelistPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), vaultAddress.toBuffer(), recipientAddress.toBuffer()],
    programId
  );

  let whitelistEntry: PublicKey | null = null;
  try {
    await (program.account as any).whitelistEntry.fetch(whitelistPda);
    whitelistEntry = whitelistPda;
  } catch {
    // Not whitelisted
  }

  // Estimate tier
  const tier1Max = Number(vault.tier1Max);
  const tier2Max = Number(vault.tier2Max);
  const rawAmountNum = Number(rawAmount);

  if (whitelistEntry) {
    // Whitelisted — send directly
  } else if (rawAmountNum <= tier1Max) {
    // Tier 1
  } else if (rawAmountNum <= tier2Max) {
    if (!isEmergency) {
      console.log(JSON.stringify({
        action: "rejected",
        reason: "Amount exceeds tier 1 max. Use --emergency flag for tier 2.",
        amount: formatUsdc(rawAmount),
        tier1Max: formatUsdc(tier1Max),
        tier2Max: formatUsdc(tier2Max),
      }, null, 2));
      process.exit(1);
    }
  } else {
    // Tier 3: create proposal instead
    console.log(JSON.stringify({
      action: "proposing",
      reason: "Amount exceeds tier 2 max. Creating proposal for human approval.",
      amount: formatUsdc(rawAmount),
    }, null, 2));

    const proposalId = vault.proposalCount;
    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vaultAddress.toBuffer(), proposalId.toArrayLike(Buffer, "le", 8)],
      programId
    );

    const tx = await program.methods
      .propose(new BN(rawAmount.toString()), `Send ${amount} USDC to ${recipientAddress.toBase58().slice(0, 8)}...`)
      .accounts({
        agent: agentKeypair.publicKey,
        vault: vaultAddress,
        recipient: recipientAddress,
        recipientAta: recipientAta.address,
        proposal: proposalPda,
        systemProgram: PublicKey.default,
      })
      .signers([agentKeypair])
      .rpc();

    console.log(JSON.stringify({
      action: "proposed",
      proposalId: proposalId.toString(),
      recipient: recipientAddress.toBase58(),
      amount: formatUsdc(rawAmount),
      tx,
    }, null, 2));
    return;
  }

  // Execute send
  const tx = await program.methods
    .sendUsdc(new BN(rawAmount.toString()), isEmergency)
    .accounts({
      signer: agentKeypair.publicKey,
      vault: vaultAddress,
      vaultUsdcAta: new PublicKey(vault.vaultUsdcAta),
      recipientAta: recipientAta.address,
      whitelistEntry: whitelistEntry,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([agentKeypair])
    .rpc();

  console.log(JSON.stringify({
    action: "sent",
    recipient: recipientAddress.toBase58(),
    amount: formatUsdc(rawAmount),
    whitelisted: !!whitelistEntry,
    isEmergency,
    tx,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
