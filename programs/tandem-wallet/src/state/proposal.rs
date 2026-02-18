use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    /// The vault this proposal belongs to.
    pub vault: Pubkey,
    /// Unique proposal ID (sequential per vault).
    pub proposal_id: u64,
    /// The recipient wallet address.
    pub recipient: Pubkey,
    /// The recipient's associated token account for USDC.
    pub recipient_ata: Pubkey,
    /// Amount of USDC (minor units) requested.
    pub amount: u64,
    /// Unix timestamp when the proposal was created.
    pub proposed_at: i64,
    /// Whether this proposal has been executed.
    pub executed: bool,
    /// Whether this proposal has been cancelled.
    pub cancelled: bool,
    /// Human-readable memo describing the purpose.
    #[max_len(128)]
    pub memo: String,
    /// PDA bump seed.
    pub bump: u8,
}

impl Proposal {
    pub const SEED_PREFIX: &'static [u8] = b"proposal";
}
