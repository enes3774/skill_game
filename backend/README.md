# Agar.io Betting Game Backend
## Ogar3 + Solana Integration

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

```bash
# Create PostgreSQL database
createdb agario_betting

# Run schema
psql agario_betting < schema.sql
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# Privy (get from https://dashboard.privy.io)
PRIVY_APP_ID=your_app_id_here
PRIVY_APP_SECRET=your_app_secret_here

# Solana (use devnet for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
GAME_WALLET_ADDRESS=your_solana_wallet_public_key

# Database
DATABASE_URL=postgresql://localhost:5432/agario_betting

# Game Settings
RAKE_PERCENTAGE=0.05
MIN_WITHDRAWAL_AMOUNT=0.01
MAX_DAILY_WITHDRAWAL=10.0
```

### 4. Start Server

```bash
npm run dev
```

Server will start on port 8080 (default from Ogar3).

---

## 🎮 How It Works

### Player Flow:

1. **Connect** - Player connects wallet via Privy
2. **Deposit** - Player deposits SOL (testnet or mainnet)
3. **Authenticate** - Backend verifies deposit on Solana
4. **Spawn** - Player joins game with monetary value
5. **Play** - Standard Agar.io gameplay
6. **Kill** - Eating opponent transfers SOL
7. **Exit** - Balance saved to database

### Kill Rewards:

- When you eat opponent's cell, you gain SOL
- Transfer amount = (eaten mass / victim total mass) × victim SOL
- 5% rake applied on kills
- SOL value displayed above cells

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.js                   # Main entry point
│   ├── BettingGameServer.js       # Wrapper integrating Ogar3 + Solana
│   ├── auth/
│   │   └── PrivyAuth.js           # Privy authentication
│   ├── blockchain/
│   │   ├── SolanaService.js       # Deposit verification
│   │   └── WithdrawalQueue.js     # Withdrawal processing
│   ├── database/
│   │   └── DatabaseService.js     # PostgreSQL operations
│   ├── security/
│   │   ├── RateLimiter.js         # Rate limiting
│   │   └── BotDetector.js         # Bot detection
│   └── game/                      # Ogar3 game files
│       ├── GameServer.js          # ✨ Modified with kill rewards
│       ├── PlayerTracker.js       # ✨ Modified with monetary fields
│       ├── entity/                # Cells, food, viruses
│       ├── gamemodes/             # FFA, Teams
│       └── packet/                # Network packets
├── client/                        # Ogar3 HTML client
├── gameserver.ini                 # Game configuration
├── schema.sql                     # Database schema
└── package.json
```

---

## 🔧 Configuration

### Game Settings (gameserver.ini)

```ini
serverPort = 8080              # WebSocket port
serverMaxConnections = 64      # Max players
serverGamemode = 0             # 0=FFA, 1=Teams
playerStartMass = 10           # Starting size
foodMaxAmount = 500            # Food on map
```

### Betting Settings (.env)

```bash
RAKE_PERCENTAGE=0.05           # 5% house fee on kills
MIN_WITHDRAWAL_AMOUNT=0.01     # Minimum SOL to withdraw
MAX_DAILY_WITHDRAWAL=10.0      # Max SOL per day per user
```

---

## 🧪 Testing

### Test with Ogar3's Client

1. Start server: `npm run dev`
2. Open browser: `http://localhost:8080`
3. You'll see Ogar3's client

### Test with Authentication

```javascript
// Client-side (JavaScript)
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
    // Send authentication
    ws.send(JSON.stringify({
        type: 'auth',
        token: 'YOUR_PRIVY_JWT_TOKEN',
        depositSignature: 'SOLANA_TX_SIGNATURE',
        depositAmount: 0.05 // SOL
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'authenticated') {
        console.log('Joined game with', data.monetaryValue, 'SOL');
    }
};
```

---

## 📊 Database Tables

Created by `schema.sql`:

- **users** - User accounts, balances
- **transactions** - All deposits, withdrawals, kills
- **games** - Game records
- **game_participations** - Player stats per game
- **withdrawal_queue** - Pending withdrawals
- **suspicious_activity** - Bot detection logs
- **processed_signatures** - Prevent double-spending

---

## 🔒 Security Features

✅ **Server-authoritative** - All game logic on server
✅ **Deposit verification** - Checks Solana blockchain
✅ **Double-spend prevention** - Signature tracking
✅ **Rate limiting** - 10 connections/minute per IP
✅ **Input validation** - All inputs sanitized
✅ **SQL injection prevention** - Parameterized queries

---

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install
```

### "Database connection failed"
```bash
# Check DATABASE_URL in .env
# Make sure PostgreSQL is running
psql -U postgres
```

### "PRIVY_APP_ID not found"
```bash
# Make sure .env file exists
cp .env.example .env
# Fill in values
```

### "Deposit verification failed"
- Use testnet SOL from faucet
- Check GAME_WALLET_ADDRESS is correct
- Verify transaction signature is valid

---

## 📝 Development Notes

### Modified Ogar3 Files:

1. **PlayerTracker.js** - Added monetary fields:
   - `privyId`, `walletAddress`, `monetaryValue`
   - `authenticated`, `totalKills`, `totalDeaths`

2. **GameServer.js** - Added kill rewards:
   - `handleKillReward()` - Transfers SOL on kills
   - `handlePlayerDeath()` - Saves balance on elimination
   - `getTotalMass()` - Helper function

### Original Ogar3 Files (Unmodified):

- `entity/` - Cell classes
- `gamemodes/` - Game modes
- `packet/` - Network protocol
- `PacketHandler.js` - Binary protocol
- `client/` - HTML/JS client

---

## 🚀 Next Steps

1. ✅ Backend working (you are here!)
2. ⏳ Build frontend (Next.js + Privy + Solana)
3. ⏳ Test full flow (deposit → play → withdraw)
4. ⏳ Deploy to production

---

## 📚 Documentation

- **OGAR3_INTEGRATION_GUIDE.md** - Integration details
- **SECURITY_CRYPTO_GUIDE.md** - Security best practices
- **BACKEND_CRYPTO_COMPLETE.md** - Architecture overview

---

**Ready to play! Start the server and test it out!** 🎮
