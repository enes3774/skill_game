#!/usr/bin/env node

require('dotenv').config();

const { BettingGameServer } = require('./BettingGameServer');

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║   Agar.io Skill-Based Betting Game Server            ║');
    console.log('║   Powered by Ogar3 + Solana                          ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');

    // Check required environment variables
    const required = [
        'PRIVY_APP_ID',
        'PRIVY_APP_SECRET',
        'SOLANA_RPC_URL',
        'GAME_WALLET_ADDRESS',
        'DATABASE_URL'
    ];

    for (const envVar of required) {
        if (!process.env[envVar]) {
            console.error(`❌ Missing required environment variable: ${envVar}`);
            console.error('   Please check your .env file');
            process.exit(1);
        }
    }

    try {
        // Initialize and start server
        const server = new BettingGameServer();
        server.start();

        console.log('');
        console.log('📋 Configuration:');
        console.log(`   Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
        console.log(`   Rake: ${(parseFloat(process.env.RAKE_PERCENTAGE || '0.05') * 100)}%`);
        console.log(`   Min Withdrawal: ${process.env.MIN_WITHDRAWAL_AMOUNT || '0.01'} SOL`);
        console.log(`   Max Daily Withdrawal: ${process.env.MAX_DAILY_WITHDRAWAL || '10.0'} SOL`);
        console.log('');
        console.log('✅ Server is ready to accept connections!');
        console.log('');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('');
            console.log('🛑 Shutting down gracefully...');

            // Pause withdrawals
            server.getWithdrawalQueue().pause();

            // Give time for active games to finish
            setTimeout(() => {
                console.log('👋 Goodbye!');
                process.exit(0);
            }, 5000);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
