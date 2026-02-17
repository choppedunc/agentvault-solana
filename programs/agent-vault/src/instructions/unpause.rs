use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;
use crate::events::*;

#[derive(Accounts)]
pub struct Unpause<'info> {
    pub human: Signer<'info>,

    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, vault.human.as_ref(), vault.agent.as_ref()],
        bump = vault.bump,
        constraint = vault.human == human.key() @ VaultError::OnlyHuman,
        constraint = vault.paused @ VaultError::VaultPaused,
    )]
    pub vault: Account<'info, Vault>,
}

pub fn handler(ctx: Context<Unpause>) -> Result<()> {
    ctx.accounts.vault.paused = false;

    emit!(VaultUnpausedEvent {
        vault: ctx.accounts.vault.key(),
    });

    Ok(())
}
