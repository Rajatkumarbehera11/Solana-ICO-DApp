use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("PROGRAM_ID");

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmatic overflow")]
    Overflow,
    #[msg("Invalid Admin")]
    InvalidAdmin,
}

#[program]
pub mod ico {

    pub const ICO_MINT_ADDRESS: &str = "IcoMintAdress";
    pub const LAMPORTS_PER_TOKEN: u64 = 1_000_000;
    pub const TOKEN_DECIMALS: u64 = 1_000_000_000;
    use super::*;

    //
    pub fn create_ico_ata(ctx: Context<CreateIcoATA>, ico_amount: u64) -> Result<()> {
        msg!("creating program ATA to hold ICO tokens");
        let raw_amount = ico_amount
            .checked_mul(TOKEN_DECIMALS)
            .ok_or(ErrorCode::Overflow)?;
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.ico_ata_for_admin.to_account_info(),
                to: ctx.accounts.ico_ata_for_ico_program.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, raw_amount)?;
        msg!("transfer {} ICO tokens to program ATA", ico_amount);

        let data = &mut ctx.accounts.data;
        data.admin = *ctx.accounts.admin.key;
        data.total_tokens = ico_amount;
        data.token_sold = 0;
        msg!("initalize ICO data");
        Ok(())
    }

    pub fn deposit_ico_in_ata(ctx: Context<DepositeIcoATA>, ico_amount: u64) -> Result<()> {
        if ctx.accounts.data.admin != *ctx.accounts.admin.key {
            return Err(error!(ErrorCode::InvalidAdmin));
        }
        let raw_amount = ico_amount
            .checked_mul(TOKEN_DECIMALS)
            .ok_or(ErrorCode::Overflow)?;
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.ico_ata_for_admin.to_account_info(),
                to: ctx.accounts.ico_ata_for_ico_program.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, raw_amount)?;
        let data = &mut ctx.accounts.data;
        data.total_tokens += ico_amount;
        msg!("Deposit {} ICO tokens to program ATA", ico_amount);
        Ok(())
    }

    pub fn buy_token(
        ctx: Context<BuyToken>,
        ico_ata_for_ico_program_bump: u8,
        token_amount: u64,
    ) -> Result<()> {
        let raw_total_amount = token_amount
            .checked_mul(TOKEN_DECIMALS)
            .ok_or(ErrorCode::Overflow)?;

        let sol_amount = token_amount
            .checked_mul(LAMPORTS_PER_TOKEN)
            .ok_or(ErrorCode::Overflow)?;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.admin.key(),
            sol_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.admin.to_account_info(),
            ],
        )?;
        msg!("transfer{} lamport to admin", sol_amount);
        let ico_mint_address = ctx.accounts.ico_mint.key();
        let seeds = &[ico_mint_address.as_ref(), &[ico_ata_for_ico_program_bump]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.ico_ata_for_ico_program.to_account_info(),
                to: ctx.accounts.ico_ata_for_user.to_account_info(),
                authority: ctx.accounts.ico_ata_for_ico_program.to_account_info(),
            },
            &signer,
        );
        token::transfer(cpi_ctx, raw_total_amount)?;
        let data = &mut ctx.accounts.data;
        data.token_sold = data
            .token_sold
            .checked_add(token_amount)
            .ok_or(ErrorCode::Overflow)?;
        msg!("Transfer {} tokens to buyer", token_amount);
        Ok(())
    }

    #[derive(Accounts)]
    pub struct CreateIcoATA<'info> {
        #[account(
            init,
            payer = admin,
            seeds = [ICO_MINT_ADDRESS.parse::<Pubkey>().unwrap().as_ref() ],
            bump,
            token::mint = ico_mint,
            token::authority = ico_ata_for_ico_program,
        )]
        pub ico_ata_for_ico_program: Account<'info, TokenAccount>,
        #[account(init,payer=admin,space=9000,seeds=[b"data",admin.key().as_ref() ],bump)]
        pub data: Account<'info, Data>,
        #[account(
            address = ICO_MINT_ADDRESS.parse::<Pubkey>().unwrap(),

        )]
        pub ico_mint: Account<'info, Mint>,
        #[account(mut)]
        pub ico_ata_for_admin: Account<'info, TokenAccount>,
        #[account(mut)]
        pub admin: Signer<'info>,

        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token>,
        pub rent: Sysvar<'info, Rent>,
    }

    #[derive(Accounts)]
    pub struct DepositeIcoATA<'info> {
        #[account(mut)]
        pub ico_ata_for_ico_program: Account<'info, TokenAccount>,
        #[account(mut)]
        pub data: Account<'info, Data>,
        #[account(
            address = ICO_MINT_ADDRESS.parse::<Pubkey>().unwrap(),

        )]
        pub ico_mint: Account<'info, Mint>,

        #[account(mut)]
        pub ico_ata_for_admin: Account<'info, TokenAccount>,

        #[account(mut)]
        pub admin: Signer<'info>,
        pub token_program: Program<'info, Token>,
    }

    #[derive(Accounts)]
    #[instruction(_ico_ata_for_ico_program_bump:u8)]
    pub struct BuyToken<'info> {
        #[account(
            mut,
            seeds=[ico_mint.key().as_ref() ],
            bump=_ico_ata_for_ico_program_bump,

        )]
        pub ico_ata_for_ico_program: Account<'info, TokenAccount>,

        #[account(mut)]
        pub data: Account<'info, Data>,

        #[account(
            address = ICO_MINT_ADDRESS.parse::<Pubkey>().unwrap(),

        )]
        pub ico_mint: Account<'info, Mint>,

        #[account(mut)]
        pub ico_ata_for_user: Account<'info, TokenAccount>,

        #[account(mut)]
        pub user: Signer<'info>,
        #[account(mut)]
        pub admin: AccountInfo<'info>,
        pub token_program: Program<'info, Token>,
        pub system_program: Program<'info, System>,
    }

    #[account]
    pub struct Data {
        pub admin: Pubkey,
        pub total_tokens: u64,
        pub token_sold: u64,
    }

}
