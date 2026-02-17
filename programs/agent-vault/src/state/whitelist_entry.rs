use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WhitelistEntry {
    /// The vault this whitelist entry belongs to.
    pub vault: Pubkey,
    /// The whitelisted recipient address.
    pub address: Pubkey,
    /// Unix timestamp when the entry was added.
    pub added_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl WhitelistEntry {
    pub const SEED_PREFIX: &'static [u8] = b"whitelist";
}
