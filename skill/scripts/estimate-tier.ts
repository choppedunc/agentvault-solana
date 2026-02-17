import { getProgram, getVaultAddress } from "./lib/client";
import { validateConfig } from "./lib/config";
import { usdcToRaw, formatUsdc } from "./lib/format";

async function main() {
  const amountStr = process.argv[2];
  if (!amountStr) {
    console.error(JSON.stringify({ error: "Usage: estimate-tier.ts <amount>" }));
    process.exit(1);
  }

  const amount = parseFloat(amountStr);
  const rawAmount = usdcToRaw(amount);

  validateConfig();
  const program = getProgram();
  const vaultAddress = getVaultAddress();
  const vault = await (program.account as any).vault.fetch(vaultAddress);

  const tier1Max = Number(vault.tier1Max);
  const tier2Max = Number(vault.tier2Max);
  const rawAmountNum = Number(rawAmount);

  let tier: string;
  let action: string;
  let requiresEmergency = false;
  let requiresApproval = false;

  if (rawAmountNum <= tier1Max) {
    tier = "Tier 1";
    action = "Execute immediately (autonomous)";
  } else if (rawAmountNum <= tier2Max) {
    tier = "Tier 2";
    action = "Execute with --emergency flag";
    requiresEmergency = true;
  } else {
    tier = "Tier 3";
    action = "Creates proposal (needs human approval)";
    requiresApproval = true;
  }

  console.log(JSON.stringify({
    amount: formatUsdc(rawAmount),
    tier,
    action,
    requiresEmergency,
    requiresApproval,
    vaultLimits: {
      tier1Max: formatUsdc(tier1Max),
      tier2Max: formatUsdc(tier2Max),
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
