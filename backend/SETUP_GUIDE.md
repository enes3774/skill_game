# Backend Setup Guide

## Quick Start (Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Solana Wallet

You need a Solana wallet address for the game to receive deposits. Here are your options:

#### Option A: Create a New Wallet (Recommended for Testing)

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Create new wallet
solana-keygen new --outfile ~/.config/solana/game-wallet.json

# Get the public key
solana-keygen pubkey ~/.config/solana/game-wallet.json
```

Copy the public key output (looks like: `7rQ9fDqBjEpvYkKwKM2NxBx9Zx9Z9Z9Z9Z9Z9Z9Z9Z9Z`)

#### Option B: Use an Existing Wallet

If you have a Phantom, Solflare, or other Solana wallet:
- Copy your wallet's public address
- It should be ~44 characters long
- Example: `7rQ9fDqBjEpvYkKwKM2NxBx9Zx9Z9Z9Z9Z9Z9Z9Z9Z9Z`

#### Option C: Generate a Test Wallet (JavaScript)

Run this script:

```bash
node scripts/generate-wallet.js
```

This will create a new keypair and show you the public key.

### 3. Set Up PostgreSQL Database

```bash
# Create database
createdb agario_betting

# Run schema
psql agario_betting < schema.sql

# Verify tables were created
psql agario_betting -c "\dt"
```

**Don't have PostgreSQL?**
- **Windows:** Download from https://www.postgresql.org/download/windows/
- **Mac:** `brew install postgresql`
- **Linux:** `sudo apt-get install postgresql`

### 4. Configure Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit .env with your values
```

**Required variables:**

```bash
# Privy (Sign up at https://dashboard.privy.io)
PRIVY_APP_ID=clm1234567890abcdef        # Your Privy App ID
PRIVY_APP_SECRET=your-secret-here        # Your Privy App Secret

# Solana Wallet (from step 2)
GAME_WALLET_ADDRESS=7rQ9fDqBjEpvYkKwKM2NxBx9Zx9Z9Z9Z9Z9Z9Z9Z9Z9Z  # Your wallet public key

# Database (from step 3)
DATABASE_URL=postgresql://localhost:5432/agario_betting
```

**Optional variables** (can use defaults):

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com    # Default: devnet
SOLANA_NETWORK=devnet                            # Default: devnet
RAKE_PERCENTAGE=0.05                             # Default: 5%
MIN_WITHDRAWAL_AMOUNT=0.01                       # Default: 0.01 SOL
MAX_DAILY_WITHDRAWAL=10.0                        # Default: 10 SOL
```

### 5. Get Privy Credentials

1. Go to https://dashboard.privy.io
2. Create account / sign in
3. Create new app
4. Go to Settings → API Keys
5. Copy:
   - **App ID** → `PRIVY_APP_ID`
   - **App Secret** → `PRIVY_APP_SECRET`

### 6. Start Server

```bash
npm run dev
```

Expected output:
```
╔═══════════════════════════════════════════════════════╗
║   Agar.io Skill-Based Betting Game Server            ║
║   Powered by Ogar3 + Solana                          ║
╚═══════════════════════════════════════════════════════╝

🎮 Initializing Betting Game Server...
Solana service initialized
Network: devnet
Game wallet: 7rQ9fDqBjEpvYkKwKM2NxBx9Zx9Z9Z9Z9Z9Z9Z9Z9Z9Z
✅ Betting Game Server initialized
🚀 Starting Betting Game Server...
[Game] Listening on port 8080
✅ Server is ready to accept connections!
```

### 7. Test the Server

Open browser: `http://localhost:8080`

You should see the Ogar3 game client.

---

## Troubleshooting

### Error: "Non-base58 character"

**Problem:** `GAME_WALLET_ADDRESS` is invalid or still set to placeholder.

**Solution:**
1. Check your `.env` file
2. Make sure `GAME_WALLET_ADDRESS` is a valid Solana public key (44 characters)
3. Should look like: `7rQ9fDqBjEpvYkKwKM2NxBx9Zx9Z9Z9Z9Z9Z9Z9Z9Z9Z`
4. **NOT** like: `your_game_wallet_public_key`

### Error: "PRIVY_APP_ID must be set"

**Problem:** Privy credentials not configured.

**Solution:**
1. Sign up at https://dashboard.privy.io
2. Create an app
3. Copy App ID and Secret to `.env`

### Error: "Database connection failed"

**Problem:** PostgreSQL not running or wrong connection string.

**Solution:**
```bash
# Check if PostgreSQL is running
sudo service postgresql status   # Linux
brew services list               # Mac

# Verify database exists
psql -l | grep agario

# Test connection
psql postgresql://localhost:5432/agario_betting
```

### Error: "Cannot find module"

**Problem:** Dependencies not installed.

**Solution:**
```bash
npm install
```

---

## Testing Without Full Setup

If you just want to test the Ogar3 game without blockchain:

### Option 1: Mock Mode (Coming Soon)
```bash
MOCK_MODE=true npm run dev
```

### Option 2: Use Minimal Config

Set only these in `.env`:
```bash
PRIVY_APP_ID=dummy_app_id
PRIVY_APP_SECRET=dummy_secret
GAME_WALLET_ADDRESS=11111111111111111111111111111111  # Solana system program
DATABASE_URL=postgresql://localhost:5432/agario_betting
```

**Note:** This won't verify real deposits, but the game will run.

---

## Production Setup

For production deployment, see:
- `DEPLOYMENT_GUIDE.md` (coming soon)
- Configure mainnet RPC
- Use real wallet with funds
- Set up monitoring
- Enable SSL/TLS

---

## Next Steps

Once the backend is running:
1. Build frontend (Next.js app)
2. Test deposit flow with testnet SOL
3. Test gameplay with multiple players
4. Test withdrawals
5. Deploy to production

---

## Need Help?

- Check `README.md` for architecture overview
- Check `INTEGRATION_COMPLETE.md` for how it works
- Check `SECURITY_CRYPTO_GUIDE.md` for security details

---

**Ready to start!** Follow the steps above and you'll be running in minutes.
