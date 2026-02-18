import { getProgram, getConnection, getAgentKeypair, getProtocolConfigAddress, getStakeAccountAddress } from "./lib/client";
import { formatUsdc } from "./lib/format";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const program = getProgram();
  const connection = getConnection();
  const staker = getAgentKeypair();

  // Fetch protocol config
  const protocolConfigAddress = getProtocolConfigAddress();
  const protocolConfig = await (program.account as any).protocolConfig.fetch(protocolConfigAddress);
  const stakerRewardAta = new PublicKey(protocolConfig.stakerRewardAta);
  const usdcMint = new PublicKey(protocolConfig.usdcMint);

  // Derive PDAs and ATAs
  const stakeAccountAddress = getStakeAccountAddress(staker.publicKey);
  const stakerUsdcAta = await getAssociatedTokenAddress(usdcMint, staker.publicKey);

  // Fetch stake account to report pending rewards
  const stakeAccount = await (program.account as any).stakeAccount.fetch(stakeAccountAddress);
  const rewardsOwed = stakeAccount.rewardsOwed;

  const tx = await (program.methods as any)
    .claimRewards()
    .accounts({
      staker: staker.publicKey,
      protocolConfig: protocolConfigAddress,
      stakeAccount: stakeAccountAddress,
      stakerRewardAta,
      stakerUsdcAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([staker])
    .rpc();

  console.log(JSON.stringify({
    action: "claimed",
    amount: formatUsdc(rewardsOwed),
    tx,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
