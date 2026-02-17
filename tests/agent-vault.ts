import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  createMint,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

// Load IDL directly since generated types may not match
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/agent_vault.json"), "utf-8"));

describe("agent-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idl, provider) as any;

  // Test accounts
  let usdcMint: PublicKey;
  let mintAuthority: Keypair;
  let human: PublicKey;
  let agent: Keypair;
  let recipient: Keypair;
  let vault: PublicKey;
  let vaultBump: number;
  let vaultUsdcAta: PublicKey;
  let recipientAta: PublicKey;

  const TIER1_MAX = new BN(50_000_000); // 50 USDC
  const TIER2_MAX = new BN(100_000_000); // 100 USDC
  const INITIAL_VAULT_BALANCE = 1_000_000_000; // 1000 USDC

  before("Setup test environment", async () => {
    mintAuthority = Keypair.generate();
    agent = Keypair.generate();
    recipient = Keypair.generate();
    human = provider.wallet.publicKey;

    // Airdrop SOL
    const sig1 = await provider.connection.requestAirdrop(mintAuthority.publicKey, 10e9);
    const sig2 = await provider.connection.requestAirdrop(agent.publicKey, 10e9);
    const sig3 = await provider.connection.requestAirdrop(recipient.publicKey, 10e9);
    await provider.connection.confirmTransaction(sig1);
    await provider.connection.confirmTransaction(sig2);
    await provider.connection.confirmTransaction(sig3);

    // Create USDC mock mint (6 decimals)
    usdcMint = await createMint(provider.connection, mintAuthority, mintAuthority.publicKey, null, 6);

    // Derive vault PDA
    [vault, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), human.toBuffer(), agent.publicKey.toBuffer()],
      program.programId
    );

    // Derive vault USDC ATA
    vaultUsdcAta = getAssociatedTokenAddressSync(usdcMint, vault, true);

    // Create recipient ATA
    const recipientAtaAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection, mintAuthority, usdcMint, recipient.publicKey
    );
    recipientAta = recipientAtaAccount.address;
  });

  it("Initializes the vault", async () => {
    await program.methods
      .initialize(TIER1_MAX, TIER2_MAX)
      .accounts({
        human,
        agent: agent.publicKey,
        usdcMint,
        vault,
        vaultUsdcAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vault);
    expect(vaultAccount.human.toString()).to.equal(human.toString());
    expect(vaultAccount.agent.toString()).to.equal(agent.publicKey.toString());
    expect(vaultAccount.tier1Max.toString()).to.equal(TIER1_MAX.toString());
    expect(vaultAccount.tier2Max.toString()).to.equal(TIER2_MAX.toString());
    expect(vaultAccount.paused).to.be.false;
    expect(vaultAccount.proposalCount.toNumber()).to.equal(0);
  });

  it("Funds the vault with USDC", async () => {
    await mintTo(provider.connection, mintAuthority, usdcMint, vaultUsdcAta, mintAuthority, INITIAL_VAULT_BALANCE);

    const balance = await getAccount(provider.connection, vaultUsdcAta);
    expect(Number(balance.amount)).to.equal(INITIAL_VAULT_BALANCE);
  });

  // --- Tier routing tests ---

  it("Agent sends Tier 1 amount (30 USDC)", async () => {
    const amount = new BN(30_000_000);
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .sendUsdc(amount, false)
      .accounts({
        signer: agent.publicKey,
        vault,
        vaultUsdcAta,
        recipientAta,
        whitelistEntry: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(30_000_000);
  });

  it("Tier 2 without emergency flag fails (NotEmergency)", async () => {
    try {
      await program.methods
        .sendUsdc(new BN(75_000_000), false)
        .accounts({
          signer: agent.publicKey,
          vault,
          vaultUsdcAta,
          recipientAta,
          whitelistEntry: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("NotEmergency");
    }
  });

  it("Tier 2 with emergency flag succeeds (75 USDC)", async () => {
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .sendUsdc(new BN(75_000_000), true)
      .accounts({
        signer: agent.publicKey,
        vault,
        vaultUsdcAta,
        recipientAta,
        whitelistEntry: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(75_000_000);
  });

  it("Over tier2_max fails (TierTooHigh)", async () => {
    try {
      await program.methods
        .sendUsdc(new BN(150_000_000), true)
        .accounts({
          signer: agent.publicKey,
          vault,
          vaultUsdcAta,
          recipientAta,
          whitelistEntry: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("TierTooHigh");
    }
  });

  // --- Proposal tests ---

  let proposal1Pda: PublicKey;

  it("Agent proposes 150 USDC", async () => {
    const proposalId = new BN(0);
    [proposal1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vault.toBuffer(), proposalId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .propose(new BN(150_000_000), "Large payment")
      .accounts({
        agent: agent.publicKey,
        vault,
        recipient: recipient.publicKey,
        recipientAta,
        proposal: proposal1Pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    const proposal = await program.account.proposal.fetch(proposal1Pda);
    expect(proposal.amount.toNumber()).to.equal(150_000_000);
    expect(proposal.executed).to.be.false;
    expect(proposal.cancelled).to.be.false;
    expect(proposal.memo).to.equal("Large payment");

    const vaultAccount = await program.account.vault.fetch(vault);
    expect(vaultAccount.proposalCount.toNumber()).to.equal(1);
  });

  it("Human approves proposal (funds transferred)", async () => {
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .approveProposal()
      .accounts({
        human,
        vault,
        proposal: proposal1Pda,
        vaultUsdcAta,
        recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(150_000_000);

    const proposal = await program.account.proposal.fetch(proposal1Pda);
    expect(proposal.executed).to.be.true;
  });

  let proposal2Pda: PublicKey;

  it("Human cancels a proposal", async () => {
    const proposalId = new BN(1);
    [proposal2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), vault.toBuffer(), proposalId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .propose(new BN(200_000_000), "Will be cancelled")
      .accounts({
        agent: agent.publicKey,
        vault,
        recipient: recipient.publicKey,
        recipientAta,
        proposal: proposal2Pda,
        systemProgram: SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    await program.methods
      .cancelProposal()
      .accounts({ human, vault, proposal: proposal2Pda })
      .rpc();

    const proposal = await program.account.proposal.fetch(proposal2Pda);
    expect(proposal.cancelled).to.be.true;
  });

  it("Agent closes executed proposal (rent reclaimed)", async () => {
    await program.methods
      .closeProposal()
      .accounts({ agent: agent.publicKey, vault, proposal: proposal1Pda })
      .signers([agent])
      .rpc();

    try {
      await program.account.proposal.fetch(proposal1Pda);
      expect.fail("Should be closed");
    } catch (e: any) {
      expect(e.message).to.include("Account does not exist");
    }
  });

  // --- Whitelist tests ---

  let whitelistPda: PublicKey;

  it("Human adds recipient to whitelist", async () => {
    [whitelistPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist"), vault.toBuffer(), recipient.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .addWhitelist(recipient.publicKey)
      .accounts({
        human,
        vault,
        whitelistEntry: whitelistPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const wl = await program.account.whitelistEntry.fetch(whitelistPda);
    expect(wl.address.toString()).to.equal(recipient.publicKey.toString());
  });

  it("Agent sends over tier2_max to whitelisted recipient (200 USDC)", async () => {
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .sendUsdc(new BN(200_000_000), false)
      .accounts({
        signer: agent.publicKey,
        vault,
        vaultUsdcAta,
        recipientAta,
        whitelistEntry: whitelistPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(200_000_000);
  });

  it("Human removes recipient from whitelist", async () => {
    await program.methods
      .removeWhitelist()
      .accounts({ human, vault, whitelistEntry: whitelistPda })
      .rpc();

    try {
      await program.account.whitelistEntry.fetch(whitelistPda);
      expect.fail("Should be closed");
    } catch (e: any) {
      expect(e.message).to.include("Account does not exist");
    }
  });

  it("Agent over-tier1 send fails after whitelist removal", async () => {
    try {
      await program.methods
        .sendUsdc(new BN(75_000_000), false)
        .accounts({
          signer: agent.publicKey,
          vault,
          vaultUsdcAta,
          recipientAta,
          whitelistEntry: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("NotEmergency");
    }
  });

  // --- Admin tests ---

  it("Human updates tiers", async () => {
    const newT1 = new BN(75_000_000);
    const newT2 = new BN(150_000_000);

    await program.methods
      .setTiers(newT1, newT2)
      .accounts({ human, vault })
      .rpc();

    const v = await program.account.vault.fetch(vault);
    expect(v.tier1Max.toString()).to.equal(newT1.toString());
    expect(v.tier2Max.toString()).to.equal(newT2.toString());
  });

  it("Human pauses vault", async () => {
    await program.methods.pause().accounts({ human, vault }).rpc();
    const v = await program.account.vault.fetch(vault);
    expect(v.paused).to.be.true;
  });

  it("Agent send fails when paused", async () => {
    try {
      await program.methods
        .sendUsdc(new BN(10_000_000), false)
        .accounts({
          signer: agent.publicKey,
          vault,
          vaultUsdcAta,
          recipientAta,
          whitelistEntry: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("VaultPaused");
    }
  });

  it("Human can still send when paused", async () => {
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .sendUsdc(new BN(10_000_000), false)
      .accounts({
        signer: human,
        vault,
        vaultUsdcAta,
        recipientAta,
        whitelistEntry: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(10_000_000);
  });

  it("Human unpauses vault", async () => {
    await program.methods.unpause().accounts({ human, vault }).rpc();
    const v = await program.account.vault.fetch(vault);
    expect(v.paused).to.be.false;
  });

  it("Agent send succeeds after unpause", async () => {
    const before = await getAccount(provider.connection, recipientAta);

    await program.methods
      .sendUsdc(new BN(10_000_000), false)
      .accounts({
        signer: agent.publicKey,
        vault,
        vaultUsdcAta,
        recipientAta,
        whitelistEntry: null,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const after = await getAccount(provider.connection, recipientAta);
    expect(Number(after.amount) - Number(before.amount)).to.equal(10_000_000);
  });
});
