# AgentVault Reference

## Program Architecture

AgentVault is a PDA-based smart account on Solana that gives AI agents controlled access to USDC funds.

### Account Structure

- **Vault PDA**: `["vault", human_pubkey, agent_pubkey]` — Stores configuration and owns USDC
- **Proposal PDA**: `["proposal", vault_pubkey, proposal_id_le_bytes]` — Pending large transfers
- **WhitelistEntry PDA**: `["whitelist", vault_pubkey, address]` — Trusted recipients

### Tier System

The vault uses a tiered spending system:
1. **Whitelist bypass**: Whitelisted recipients have no spending limit
2. **Tier 1** (≤ tier1_max): Agent can send autonomously
3. **Tier 2** (≤ tier2_max): Agent can send with emergency flag
4. **Tier 3** (> tier2_max): Requires proposal → human approval

### Security Model

- Human has full control: can send, pause, unpause, set tiers, whitelist
- Agent has limited control: can send within tiers, propose, close proposals
- Vault is paused → agent cannot send or propose
- Human can always send, even when paused
