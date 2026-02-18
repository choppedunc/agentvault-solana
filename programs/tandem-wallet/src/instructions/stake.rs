use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::errors::*;
use crate::events::*;
use crate::helpers;

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        mut,
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump = protocol_config.bump,
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [StakeAccount::SEED_PREFIX, staker.key().as_ref()],
        bump,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    /// Staker's TANDEM token account
    #[account(
        mut,
        constraint = staker_tandem_ata.mint == protocol_config.tandem_mint,
        constraint = staker_tandem_ata.owner == staker.key(),
    )]
    pub staker_tandem_ata: Box<Account<'info, TokenAccount>>,

    /// Protocol's TANDEM ATA where staked tokens are held
    #[account(
        mut,
        associated_token::mint = tandem_mint,
        associated_token::authority = protocol_config,
    )]
    pub stake_tandem_ata: Box<Account<'info, TokenAccount>>,

    /// Staker reward USDC ATA (for balance check in update_rewards)
    #[account(
        constraint = staker_reward_ata.key() == protocol_config.staker_reward_ata,
    )]
    pub staker_reward_ata: Box<Account<'info, TokenAccount>>,

    pub tandem_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);

    let config = &mut ctx.accounts.protocol_config;
    let stake_account = &mut ctx.accounts.stake_account;
    let reward_balance = ctx.accounts.staker_reward_ata.amount;

    // Lazy reward update before state change
    helpers::update_rewards(config, Some(stake_account), reward_balance)?;

    // Transfer TANDEM from staker to protocol
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.staker_tandem_ata.to_account_info(),
            to: ctx.accounts.stake_tandem_ata.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    // Update stake state
    stake_account.staker = ctx.accounts.staker.key();
    stake_account.staked_amount = stake_account
        .staked_amount
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;
    stake_account.last_stake_ts = Clock::get()?.unix_timestamp;
    stake_account.bump = ctx.bumps.stake_account;

    config.total_staked = config
        .total_staked
        .checked_add(amount)
        .ok_or(VaultError::Overflow)?;

    emit!(Staked {
        staker: ctx.accounts.staker.key(),
        amount,
        total_staked: config.total_staked,
    });

    Ok(())
}
