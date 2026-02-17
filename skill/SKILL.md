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

## Prerequisites

Environment variables must be set:
- `AGENT_PRIVATE_KEY` - Base58-encoded agent keypair
- `VAULT_ADDRESS` - Vault PDA address (base58)
- `RPC_URL` - Solana RPC endpoint (default: https://api.devnet.solana.com)
- `PROGRAM_ID` - AgentVault program ID (default: 6L2hon3xSV9saeaGG7cgFG298JGW4vf9jDtF5xg8E6pZ)

Install dependencies first:
```bash
cd /Users/max/Projects/agentvault-solana/skill/scripts && npm install
```

## Tier System

| Tier | Condition | Action |
|------|-----------|--------|
| Whitelist | Recipient whitelisted | Execute immediately, no limit |
| Tier 1 | amount ≤ tier1_max | Execute immediately |
| Tier 2 | amount ≤ tier2_max + emergency flag | Execute immediately |
| Tier 3 | amount > tier2_max | Creates proposal, needs human approval |

## Available Operations

### Check Vault Status
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/vault-status.ts
```
Returns: human, agent, tiers, paused state, USDC balance, SOL balance, proposal count.

### Check Balance
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/vault-balance.ts
```
Returns: SOL and USDC balances only.

### Send USDC
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/send-usdc.ts <recipient> <amount> [--emergency]
```
- `recipient`: Wallet address (base58)
- `amount`: USDC amount (e.g., "50" for 50 USDC)
- `--emergency`: Flag for tier 2 emergency sends

Auto tier-routes: executes if within tier limits, creates proposal if over tier2_max.

### List Proposals
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/list-proposals.ts [pending|executed|cancelled|all]
```

### Get Proposal Details
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/get-proposal.ts <proposal_id>
```

### Estimate Tier
```bash
npx ts-node /Users/max/Projects/agentvault-solana/skill/scripts/estimate-tier.ts <amount>
```
Preview which tier an amount would fall into.

## Error Handling

| Error | Meaning |
|-------|---------|
| VaultPaused | Vault is paused by human owner |
| NotEmergency | Amount needs --emergency flag |
| TierTooHigh | Use propose for large amounts |

## Safety Notes

- Never expose or log the AGENT_PRIVATE_KEY
- Always verify recipient addresses before sending
- Use estimate-tier before sending to preview the action
