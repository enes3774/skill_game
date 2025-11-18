import { Pool, QueryResult } from 'pg';

export interface User {
  id: string;
  privyId: string;
  walletAddress: string;
  username?: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  gamesPlayed: number;
  totalKills: number;
  totalDeaths: number;
}

export interface Transaction {
  id?: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'kill' | 'death' | 'rake' | 'refund';
  amount: number;
  status?: string;
  signature?: string;
  destinationWallet?: string;
  ipAddress?: string;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  /**
   * Get user by Privy ID
   */
  async getUserByPrivyId(privyId: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE privy_id = $1',
      [privyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create or update user
   */
  async upsertUser(privyId: string, walletAddress: string, email?: string): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (privy_id, wallet_address, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (privy_id)
       DO UPDATE SET wallet_address = $2, email = $3, last_login_at = NOW()
       RETURNING *`,
      [privyId, walletAddress, email]
    );
    return result.rows[0];
  }

  /**
   * Update user balance (atomic)
   */
  async updateUserBalance(privyId: string, amount: number): Promise<void> {
    await this.pool.query(
      'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE privy_id = $2',
      [amount, privyId]
    );
  }

  /**
   * Create transaction
   */
  async createTransaction(tx: Transaction): Promise<void> {
    await this.pool.query(
      `INSERT INTO transactions (user_id, type, amount, status, signature, destination_wallet, ip_address)
       SELECT id, $2, $3, $4, $5, $6, $7
       FROM users WHERE privy_id = $1`,
      [tx.userId, tx.type, tx.amount, tx.status || 'pending', tx.signature, tx.destinationWallet, tx.ipAddress]
    );
  }

  /**
   * Update transaction signature
   */
  async updateTransactionSignature(userId: string, signature: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE transactions SET signature = $1, status = $2, confirmed_at = NOW()
       WHERE user_id = (SELECT id FROM users WHERE privy_id = $3) AND signature IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [signature, status, userId]
    );
  }

  /**
   * Get total withdrawals for today
   */
  async getDailyWithdrawals(privyId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = (SELECT id FROM users WHERE privy_id = $1)
         AND type = 'withdrawal'
         AND created_at >= CURRENT_DATE`,
      [privyId]
    );
    return parseFloat(result.rows[0].total);
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawalRequest(request: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO withdrawal_queue (id, user_id, amount, net_amount, rake, destination_wallet, status)
       SELECT $1, id, $2, $3, $4, $5, $6
       FROM users WHERE privy_id = $7`,
      [request.id, request.amount, request.netAmount, request.rake, request.destinationWallet, request.status, request.userId]
    );
  }

  /**
   * Update withdrawal status
   */
  async updateWithdrawalStatus(id: string, status: string, signature?: string, error?: string): Promise<void> {
    await this.pool.query(
      `UPDATE withdrawal_queue
       SET status = $1, signature = $2, error_message = $3, processed_at = NOW()
       WHERE id = $4`,
      [status, signature, error, id]
    );
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId: string,
    activityType: string,
    data: any,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO suspicious_activity (user_id, activity_type, description, data, severity)
       SELECT id, $2, $3, $4, $5
       FROM users WHERE privy_id = $1`,
      [userId, activityType, JSON.stringify(data), JSON.stringify(data), severity]
    );
  }

  /**
   * Mark signature as processed
   */
  async markSignatureProcessed(signature: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO processed_signatures (signature) VALUES ($1) ON CONFLICT DO NOTHING',
      [signature]
    );
  }

  /**
   * Check if signature is processed
   */
  async isSignatureProcessed(signature: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM processed_signatures WHERE signature = $1',
      [signature]
    );
    return result.rows.length > 0;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
