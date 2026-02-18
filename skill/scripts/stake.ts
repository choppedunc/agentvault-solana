import { getProgram, getConnection, getAgentKeypair, getProtocolConfigAddress, getStakeAccountAddress } from "./lib/client";
import { formatToken } from "./lib/format";
import { getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  const amountStr = process.argv[2];
  if (!amountStr) {
    console.error(JSON.stringify({ error: "Usage: stake.ts <amount>" }));
    process.exit(1);
  }

  const amount = parseFloat(amountStr);
  const program = getProgram();
  const connection = getConnection();
  const staker = getAgentKeypair();

  // Fetch protocol config
  const protocolConfigAddress = getProtocolConfigAddress();
  const protocolConfig = await (program.account as any).protocolConfig.fetch(protocolConfigAddress);
  const tandemMint = new PublicKey(protocolConfig.tandemMint);
  const stakerRewardAta = new PublicKey(protocolConfig.stakerRewardAta);

  // Get mint decimals and convert amount
  const mintInfo = await getMint(connection, tandemMint);
  const rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

  // Derive PDAs and ATAs
  const stakeAccountAddress = getStakeAccountAddress(staker.publicKey);
  const stakerTandemAta = await getAssociatedTokenAddress(tandemMint, staker.publicKey);
  const stakeTandemAta = await getAssociatedTokenAddress(tandemMint, protocolConfigAddress, true);

  const tx = await (program.methods as any)
    .stake(new BN(rawAmount.toString()))
    .accounts({
      staker: staker.publicKey,
      protocolConfig: protocolConfigAddress,
      stakeAccount: stakeAccountAddress,
      stakerTandemAta,
      stakeTandemAta,
      stakerRewardAta,
      tandemMint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([staker])
    .rpc();

  console.log(JSON.stringify({
    action: "staked",
    amount: formatToken(rawAmount, mintInfo.decimals, "TANDEM"),
    tx,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
