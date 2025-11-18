const { Pool } = require('pg');

class DatabaseService {
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

    async query(text, params) {
        return this.pool.query(text, params);
    }

    /**
     * Get user by Privy ID
     */
    async getUserByPrivyId(privyId) {
        const result = await this.pool.query(
            'SELECT * FROM users WHERE privy_id = $1',
            [privyId]
        );
        return result.rows[0] || null;
    }

    /**
     * Create or update user
     */
    async upsertUser(privyId, walletAddress, email) {
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
    async updateUserBalance(privyId, amount) {
        await this.pool.query(
            'UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE privy_id = $2',
            [amount, privyId]
        );
    }

    /**
     * Create transaction
     */
    async createTransaction(tx) {
        await this.pool.query(
            `INSERT INTO transactions (user_id, type, amount, status, signature, destination_wallet, ip_address)
             SELECT id, $2, $3, $4, $5, $6, $7
             FROM users WHERE privy_id = $1`,
            [tx.userId, tx.type, tx.amount, tx.status || 'pending', tx.signature, tx.destinationWallet, tx.ipAddress]
        );
    }

    /**
     * Mark signature as processed
     */
    async markSignatureProcessed(signature) {
        await this.pool.query(
            'INSERT INTO processed_signatures (signature) VALUES ($1) ON CONFLICT DO NOTHING',
            [signature]
        );
    }

    /**
     * Check if signature is processed
     */
    async isSignatureProcessed(signature) {
        const result = await this.pool.query(
            'SELECT 1 FROM processed_signatures WHERE signature = $1',
            [signature]
        );
        return result.rows.length > 0;
    }

    /**
     * Close database connection
     */
    async close() {
        await this.pool.end();
    }
}

module.exports = { DatabaseService };
