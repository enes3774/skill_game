import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

export interface DepositVerification {
  valid: boolean;
  amount?: number;
  sender?: string;
  blockTime?: number | null;
  slot?: number;
  error?: string;
}

export class SolanaService {
  private connection: Connection;
  private gameWallet: PublicKey;
  private processedSignatures: Set<string>;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    const gameWalletAddress = process.env.GAME_WALLET_ADDRESS;
    if (!gameWalletAddress) {
      throw new Error('GAME_WALLET_ADDRESS must be set');
    }

    this.gameWallet = new PublicKey(gameWalletAddress);
    this.processedSignatures = new Set();

    console.log(`Solana service initialized`);
    console.log(`Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
    console.log(`Game wallet: ${this.gameWallet.toString()}`);
  }

  /**
   * Verify a deposit transaction on Solana blockchain
   */
  async verifyDeposit(
    signature: string,
    expectedAmount: number,
    expectedSender: string
  ): Promise<DepositVerification> {
    try {
      // Prevent double-processing
      if (this.processedSignatures.has(signature)) {
        return { valid: false, error: 'already_processed' };
      }

      // Fetch transaction from blockchain
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        return { valid: false, error: 'transaction_not_found' };
      }

      // Verify transaction succeeded
      if (tx.meta?.err) {
        return { valid: false, error: 'transaction_failed' };
      }

      // Parse account keys
      const accountKeys = tx.transaction.message.getAccountKeys();
      const instructions = tx.transaction.message.compiledInstructions;

      if (instructions.length === 0) {
        return { valid: false, error: 'no_instructions' };
      }

      // Find transfer instruction
      const transferInstruction = instructions[0];
      const fromPubkey = accountKeys.get(transferInstruction.accountKeyIndexes[0]);
      const toPubkey = accountKeys.get(transferInstruction.accountKeyIndexes[1]);

      if (!fromPubkey || !toPubkey) {
        return { valid: false, error: 'invalid_instruction' };
      }

      // Verify recipient is our game wallet
      if (toPubkey.toString() !== this.gameWallet.toString()) {
        console.error(`Wrong recipient: ${toPubkey.toString()} != ${this.gameWallet.toString()}`);
        return { valid: false, error: 'wrong_recipient' };
      }

      // Verify sender
      if (fromPubkey.toString() !== expectedSender) {
        console.error(`Wrong sender: ${fromPubkey.toString()} != ${expectedSender}`);
        return { valid: false, error: 'wrong_sender' };
      }

      // Verify amount
      const preBalance = tx.meta.preBalances[1];
      const postBalance = tx.meta.postBalances[1];
      const actualAmount = (postBalance - preBalance) / LAMPORTS_PER_SOL;

      if (Math.abs(actualAmount - expectedAmount) > 0.0001) {
        console.error(`Wrong amount: ${actualAmount} != ${expectedAmount}`);
        return { valid: false, error: 'wrong_amount' };
      }

      // Mark as processed
      this.processedSignatures.add(signature);

      return {
        valid: true,
        amount: actualAmount,
        sender: fromPubkey.toString(),
        blockTime: tx.blockTime,
        slot: tx.slot
      };

    } catch (error) {
      console.error('Deposit verification failed:', error);
      return { valid: false, error: 'verification_error' };
    }
  }

  /**
   * Send SOL from game wallet to player (withdrawal)
   */
  async sendWithdrawal(
    destinationWallet: string,
    amount: number,
    gameWalletKeypair: Keypair
  ): Promise<string> {
    try {
      const destination = new PublicKey(destinationWallet);

      // Create transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: gameWalletKeypair.publicKey,
          toPubkey: destination,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL)
        })
      );

      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [gameWalletKeypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed'
        }
      );

      console.log(`Withdrawal successful: ${signature}`);
      return signature;

    } catch (error) {
      console.error('Withdrawal failed:', error);
      throw error;
    }
  }

  /**
   * Get game wallet balance
   */
  async getGameWalletBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.gameWallet);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Failed to get wallet balance:', error);
      return 0;
    }
  }

  /**
   * Get user wallet balance
   */
  async getUserWalletBalance(walletAddress: string): Promise<number> {
    try {
      const pubkey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('Failed to get user balance:', error);
      return 0;
    }
  }

  /**
   * Check if signature already processed (prevent double-spend)
   */
  isSignatureProcessed(signature: string): boolean {
    return this.processedSignatures.has(signature);
  }
}
