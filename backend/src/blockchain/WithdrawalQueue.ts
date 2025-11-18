import { SolanaService } from './SolanaService';
import { DatabaseService } from '../database/DatabaseService';
import { Keypair } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';

interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  netAmount: number;
  rake: number;
  destinationWallet: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  attempts: number;
}

export interface WithdrawalResponse {
  success: boolean;
  error?: string;
  withdrawalId?: string;
  netAmount?: number;
  rake?: number;
  estimatedTime?: number;
}

export class WithdrawalQueue {
  private queue: WithdrawalRequest[] = [];
  private processing = false;
  private solana: SolanaService;
  private db: DatabaseService;
  private gameWalletKeypair: Keypair | null = null;

  constructor(solana: SolanaService, db: DatabaseService) {
    this.solana = solana;
    this.db = db;
  }

  /**
   * Set the game wallet keypair (loaded securely)
   */
  setGameWallet(keypair: Keypair) {
    this.gameWalletKeypair = keypair;
  }

  /**
   * Request a withdrawal
   */
  async requestWithdrawal(
    userId: string,
    amount: number,
    destinationWallet: string,
    ipAddress?: string
  ): Promise<WithdrawalResponse> {
    try {
      // Validate amount
      const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || '0.01');
      if (amount < minWithdrawal) {
        return { success: false, error: 'amount_too_small' };
      }

      // Get user balance
      const user = await this.db.getUserByPrivyId(userId);
      if (!user || user.balance < amount) {
        return { success: false, error: 'insufficient_balance' };
      }

      // Check daily limit
      const maxDaily = parseFloat(process.env.MAX_DAILY_WITHDRAWAL || '10.0');
      const todayWithdrawals = await this.db.getDailyWithdrawals(userId);

      if (todayWithdrawals + amount > maxDaily) {
        return {
          success: false,
          error: 'daily_limit_exceeded',
        };
      }

      // Calculate rake
      const rakePercentage = parseFloat(process.env.RAKE_PERCENTAGE || '0.10');
      const rake = amount * rakePercentage;
      const netAmount = amount - rake;

      // Deduct from user balance immediately (prevent double withdrawal)
      await this.db.updateUserBalance(userId, -amount);

      // Create withdrawal request
      const request: WithdrawalRequest = {
        id: uuidv4(),
        userId,
        amount,
        netAmount,
        rake,
        destinationWallet,
        status: 'queued',
        createdAt: Date.now(),
        attempts: 0
      };

      // Add to database
      await this.db.createWithdrawalRequest(request);

      // Add to queue
      this.queue.push(request);

      // Log pending transaction
      await this.db.createTransaction({
        userId,
        type: 'withdrawal',
        amount,
        status: 'pending',
        destinationWallet,
        ipAddress
      });

      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }

      return {
        success: true,
        withdrawalId: request.id,
        netAmount,
        rake,
        estimatedTime: this.queue.length * 2000 // 2 seconds per withdrawal
      };

    } catch (error) {
      console.error('Withdrawal request failed:', error);
      return { success: false, error: 'request_failed' };
    }
  }

  /**
   * Process withdrawal queue
   */
  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        // Update status to processing
        request.status = 'processing';
        await this.db.updateWithdrawalStatus(request.id, 'processing');

        // Send SOL
        if (!this.gameWalletKeypair) {
          throw new Error('Game wallet not initialized');
        }

        const signature = await this.solana.sendWithdrawal(
          request.destinationWallet,
          request.netAmount,
          this.gameWalletKeypair
        );

        // Update database
        await this.db.updateWithdrawalStatus(request.id, 'completed', signature);
        await this.db.updateTransactionSignature(request.userId, signature, 'confirmed');

        // Log rake collection
        await this.db.createTransaction({
          userId: 'house',
          type: 'rake',
          amount: request.rake,
          status: 'confirmed'
        });

        console.log(`Withdrawal completed: ${request.id} - ${signature}`);

        // Remove from queue
        this.queue.shift();

      } catch (error) {
        console.error('Withdrawal processing failed:', error);

        request.attempts++;

        // Retry up to 3 times
        if (request.attempts < 3) {
          console.log(`Retrying withdrawal ${request.id} (attempt ${request.attempts + 1})`);
          // Move to end of queue
          this.queue.push(this.queue.shift()!);

        } else {
          // Failed permanently - refund user
          await this.db.updateUserBalance(request.userId, request.amount);
          await this.db.updateWithdrawalStatus(
            request.id,
            'failed',
            undefined,
            (error as Error).message
          );

          console.error(`Withdrawal failed permanently: ${request.id}`);

          // Remove from queue
          this.queue.shift();
        }
      }

      // Rate limit: 2 seconds between withdrawals
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      estimatedWaitTime: this.queue.length * 2000
    };
  }

  /**
   * Pause withdrawal processing (emergency)
   */
  pause() {
    this.processing = false;
    console.warn('Withdrawal queue paused');
  }

  /**
   * Resume withdrawal processing
   */
  resume() {
    if (!this.processing && this.queue.length > 0) {
      console.log('Withdrawal queue resumed');
      this.processQueue();
    }
  }
}
