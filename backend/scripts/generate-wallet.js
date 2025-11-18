#!/usr/bin/env node

/**
 * Generate a Solana wallet for testing
 * This creates a new keypair and shows the public key
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   Solana Wallet Generator                            ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

// Generate new keypair
const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toString();
const secretKey = Buffer.from(keypair.secretKey).toString('base64');

console.log('✅ New wallet generated!');
console.log('');
console.log('📋 Public Key (use this for GAME_WALLET_ADDRESS):');
console.log('   ' + publicKey);
console.log('');
console.log('🔐 Secret Key (KEEP THIS SAFE - needed for withdrawals):');
console.log('   ' + secretKey);
console.log('');

// Save to file
const walletDir = path.join(__dirname, '..', '.wallets');
if (!fs.existsSync(walletDir)) {
    fs.mkdirSync(walletDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const walletFile = path.join(walletDir, `wallet-${timestamp}.json`);

const walletData = {
    publicKey: publicKey,
    secretKey: secretKey,
    secretKeyArray: Array.from(keypair.secretKey),
    createdAt: new Date().toISOString(),
    network: 'devnet'
};

fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));

console.log('💾 Wallet saved to:');
console.log('   ' + walletFile);
console.log('');
console.log('📝 Next steps:');
console.log('   1. Copy the public key above');
console.log('   2. Paste it into your .env file as GAME_WALLET_ADDRESS');
console.log('   3. For withdrawals, you\'ll need the secret key');
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('   - Never share your secret key');
console.log('   - Never commit wallet files to git');
console.log('   - For production, use a hardware wallet');
console.log('');
console.log('🎮 Fund your wallet with testnet SOL:');
console.log('   https://solfaucet.com/');
console.log('   Paste: ' + publicKey);
console.log('');
