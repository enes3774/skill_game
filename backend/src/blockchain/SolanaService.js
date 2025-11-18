const {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    Keypair,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');

class SolanaService {
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
    async verifyDeposit(signature, expectedAmount, expectedSender) {
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
     * Check if signature already processed (prevent double-spend)
     */
    isSignatureProcessed(signature) {
        return this.processedSignatures.has(signature);
    }
}

module.exports = { SolanaService };
