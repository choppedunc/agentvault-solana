const USDC_DECIMALS = 6;

export function usdcToRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

export function rawToUsdc(raw: bigint | number): number {
  return Number(raw) / 10 ** USDC_DECIMALS;
}

export function formatUsdc(raw: bigint | number): string {
  return `${rawToUsdc(raw).toFixed(2)} USDC`;
}

export function formatSol(lamports: number): string {
  return `${(lamports / 1e9).toFixed(4)} SOL`;
}
