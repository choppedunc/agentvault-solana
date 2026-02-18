import { getProgram, getConnection, getAgentKeypair, getProtocolConfigAddress, getStakeAccountAddress } from "./lib/client";
import { formatToken } from "./lib/format";
import { getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const program = getProgram();
  const connection = getConnection();
  const staker = getAgentKeypair();

  // Fetch protocol config
  const protocolConfigAddress = getProtocolConfigAddress();
  const protocolConfig = await (program.account as any).protocolConfig.fetch(protocolConfigAddress);
  const tandemMint = new PublicKey(protocolConfig.tandemMint);
  const stakerRewardAta = new PublicKey(protocolConfig.stakerRewardAta);

  // Get mint decimals for formatting
  const mintInfo = await getMint(connection, tandemMint);

  // Derive PDAs and ATAs
  const stakeAccountAddress = getStakeAccountAddress(staker.publicKey);
  const stakerTandemAta = await getAssociatedTokenAddress(tandemMint, staker.publicKey);
  const stakeTandemAta = await getAssociatedTokenAddress(tandemMint, protocolConfigAddress, true);

  // Fetch stake account to report amount
  const stakeAccount = await (program.account as any).stakeAccount.fetch(stakeAccountAddress);
  const stakedAmount = stakeAccount.stakedAmount;

  const tx = await (program.methods as any)
    .unstake()
    .accounts({
      staker: staker.publicKey,
      protocolConfig: protocolConfigAddress,
      stakeAccount: stakeAccountAddress,
      stakerTandemAta,
      stakeTandemAta,
      stakerRewardAta,
      tandemMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([staker])
    .rpc();

  console.log(JSON.stringify({
    action: "unstaked",
    amount: formatToken(stakedAmount, mintInfo.decimals, "TANDEM"),
    tx,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
