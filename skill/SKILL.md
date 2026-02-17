---
name: agentvault
description: >-
  Manage an AgentVault smart account on Solana. Check vault balances and status,
  send USDC with automatic tier routing, list and inspect pending proposals,
  and estimate spending tiers. Use when the user asks about their vault, wants to
  send USDC, check balances, or manage proposals.
compatibility: Requires Node.js 18+ and network access to a Solana RPC endpoint.
allowed-tools: Bash Read
---

# AgentVault Skill

## Setup

1. Clone the repo and install dependencies:
```bash
git clone https://github.com/choppedunc/agentvault-solana.git
cd agentvault-solana/skill/scripts
npm install
```

2. Create a `.env` file in `skill/scripts/`:
```
AGENT_PRIVATE_KEY=<base58-encoded-agent-keypair>
VAULT_ADDRESS=<vault-PDA-address>
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=6L2hon3xSV9saeaGG7cgFG298JGW4vf9jDtF5xg8E6pZ
```

All scripts must be run from the `skill/scripts/` directory.

## Running Scripts

Run scripts from the `skill/scripts/` directory using:
```bash
cd agentvault-solana/skill/scripts
node -r ts-node/register <script>.ts [args]
```

If on Node.js 24+, use:
```bash
node --no-experimental-strip-types -r ts-node/register <script>.ts [args]
```

## Devnet Test Deployment

A test vault is deployed on Solana devnet:

| Key | Value |
|-----|-------|
| Program ID | `6L2hon3xSV9saeaGG7cgFG298JGW4vf9jDtF5xg8E6pZ` |
| Vault PDA | `C4Cn5s5JQ8cWWf3HWi7zkYt3aE2pkwVHF1gfDJ742JC8` |
| Mock USDC Mint | `AyTVMMCjm3EcFw6wCVHyuTdgqL4anApR1VmWjjESGajb` |
| Tier 1 Max | 50 USDC (autonomous) |
| Tier 2 Max | 100 USDC (emergency) |

To test, set `VAULT_ADDRESS=C4Cn5s5JQ8cWWf3HWi7zkYt3aE2pkwVHF1gfDJ742JC8` in your `.env`.

The agent wallet needs a small amount of SOL (0.01+) for transaction fees.

## Tier System

| Tier | Condition | Action |
|------|-----------|--------|
| Whitelist | Recipient whitelisted | Execute immediately, no limit |
| Tier 1 | amount ≤ tier1_max (50 USDC) | Execute immediately |
| Tier 2 | amount ≤ tier2_max (100 USDC) + emergency flag | Execute immediately |
| Tier 3 | amount > tier2_max | Creates proposal, needs human approval |

## Available Operations

### Check Vault Status
```bash
node -r ts-node/register vault-status.ts
```
Returns: human, agent, tiers, paused state, USDC balance, SOL balance, proposal count.

### Check Balance
```bash
node -r ts-node/register vault-balance.ts
```
Returns: SOL and USDC balances only.

### Send USDC
```bash
node -r ts-node/register send-usdc.ts <recipient> <amount> [--emergency]
```
- `recipient`: Wallet address (base58)
- `amount`: USDC amount (e.g., "50" for 50 USDC)
- `--emergency`: Required for tier 2 sends (amount between tier1_max and tier2_max)

Auto tier-routes: executes if within tier limits, creates proposal if over tier2_max.

### List Proposals
```bash
node -r ts-node/register list-proposals.ts [pending|executed|cancelled|all]
```
Default filter is `pending`.

### Get Proposal Details
```bash
node -r ts-node/register get-proposal.ts <proposal_id>
```

### Estimate Tier
```bash
node -r ts-node/register estimate-tier.ts <amount>
```
Preview which tier an amount would fall into without executing.

## Error Handling

All scripts output JSON. On success, the result is printed to stdout. On failure, an error JSON is printed to stderr.

| Error | Meaning |
|-------|---------|
| VaultPaused | Vault is paused by human owner — cannot send |
| NotEmergency | Amount is in tier 2 range — add `--emergency` flag |
| TierTooHigh | Amount exceeds tier 2 max — will auto-propose instead |
| ZeroAmount | Cannot send 0 USDC |

## Safety Notes

- Never expose or log the AGENT_PRIVATE_KEY
- Always verify recipient addresses before sending
- Use `estimate-tier` before sending to preview the action
- The agent can only spend up to tier limits autonomously — larger amounts require human approval
