use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct SetTiers<'info> {
    pub human: Signer<'info>,

    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, vault.human.as_ref(), vault.agent.as_ref()],
        bump = vault.bump,
        constraint = vault.human == human.key() @ VaultError::OnlyHuman,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<SetTiers>, tier1_max: u64, tier2_max: u64) -> Result<()> {
    require!(tier1_max <= tier2_max, VaultError::InvalidThresholds);

    let vault = &mut ctx.accounts.vault;
    vault.tier1_max = tier1_max;
    vault.tier2_max = tier2_max;

    emit!(TiersUpdated {
        vault: vault.key(),
        tier1_max,
        tier2_max,
    });

    Ok(())
}
