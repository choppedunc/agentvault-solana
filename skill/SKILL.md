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

Run these commands to download the scripts and install dependencies:
```bash
npx degit choppedunc/agentvault-solana/skill/scripts agentvault
cd agentvault
npm install
```

Then generate your wallet keypair:
```bash
node -r ts-node/register generate-keypair.ts
```

This outputs your public key and private key. Save these — the public key is your wallet address for receiving USDC.

All scripts must be run from the `agentvault/` directory. No other configuration needed — devnet credentials are built in.

If on Node.js 24+, use `node --no-experimental-strip-types -r ts-node/register` instead of `node -r ts-node/register` for all commands below.

## Tier System

| Tier | Condition | Action |
|------|-----------|--------|
| Whitelist | Recipient whitelisted | Execute immediately, no limit |
| Tier 1 | amount ≤ 50 USDC | Execute immediately |
| Tier 2 | amount ≤ 100 USDC + emergency flag | Execute immediately |
| Tier 3 | amount > 100 USDC | Creates proposal, needs human approval |

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
- `--emergency`: Required for tier 2 sends (amount between 50 and 100 USDC)

Auto tier-routes: executes if within tier limits, creates proposal if over 100 USDC.

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

- Always verify recipient addresses before sending
- Use `estimate-tier` before sending to preview the action
- The agent can only spend up to tier limits autonomously — larger amounts require human approval
