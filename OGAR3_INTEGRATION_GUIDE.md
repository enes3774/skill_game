# Ogar3 + Solana Integration Guide
## Complete Implementation Plan

---

## 🎯 Repository Chosen: Faris90/Ogar3

**Why Ogar3 is Perfect:**
- ✅ Node.js (integrates seamlessly with our TypeScript backend)
- ✅ WebSocket based (ws library)
- ✅ Server-authoritative (all game logic on server)
- ✅ No blockchain lock-in (clean slate for Solana)
- ✅ Modular architecture (easy to extend)
- ✅ Proven game mechanics (splitting, viruses, ejecting mass)

---

## 📁 Ogar3 Structure

```
ogar3_reference/
├── index.js              # Entry point
├── GameServer.js         # Main game server (CRITICAL)
├── PlayerTracker.js      # Player state management (MODIFY THIS)
├── PacketHandler.js      # Network packet handling
├── package.json          # Dependencies (ws, serve-static)
├── entity/
│   ├── Cell.js          # Base cell class
│   ├── PlayerCell.js    # Player-controlled cells (MODIFY THIS)
│   ├── Food.js          # Food pellets
│   ├── Virus.js         # Viruses
│   ├── EjectedMass.js   # Ejected mass
│   └── MotherCell.js    # Mother cells
├── gamemodes/           # FFA, Teams, etc.
├── packet/              # Network packet definitions
├── ai/                  # Bot players
└── client/              # HTML/JS client files
```

---

## 🔧 Integration Steps

### Step 1: Copy Ogar3 to Your Backend

```bash
# From skill_game directory
cp -r ogar3_reference/entity backend/src/game/entity
cp -r ogar3_reference/gamemodes backend/src/game/gamemodes
cp -r ogar3_reference/packet backend/src/game/packet
cp ogar3_reference/GameServer.js backend/src/game/GameServer.js
cp ogar3_reference/PlayerTracker.js backend/src/game/PlayerTracker.js
cp ogar3_reference/PacketHandler.js backend/src/game/PacketHandler.js
```

### Step 2: Modify PlayerTracker.js - Add Monetary Fields

**File:** `backend/src/game/PlayerTracker.js`

Add these fields to the `PlayerTracker` constructor:

```javascript
function PlayerTracker(gameServer, socket) {
    // ... existing fields ...
    this.pID = -1;
    this.name = "";
    this.cells = [];
    this.score = 0;

    // 🆕 NEW: Add crypto fields
    this.privyId = null;           // Privy user ID
    this.walletAddress = null;      // Solana wallet
    this.monetaryValue = 0;         // Current SOL value
    this.authenticated = false;      // Auth status
    this.initialDeposit = 0;        // Entry amount
    this.totalKills = 0;            // Kill counter
    this.totalDeaths = 0;           // Death counter
}
```

### Step 3: Modify PlayerCell.js - Track Cell Value

**File:** `backend/src/game/entity/PlayerCell.js`

Add monetary value to each cell:

```javascript
function PlayerCell(nodeId, owner, position, size) {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    // ... existing fields ...

    // 🆕 NEW: Monetary value of this cell
    this.monetaryValue = 0;
}
```

### Step 4: Modify GameServer.js - Add Kill Rewards

**File:** `backend/src/game/GameServer.js`

Find the function that handles cell eating (usually in collision detection), and modify it:

```javascript
// Original Ogar3 code (approximately):
GameServer.prototype.removeNode = function(node) {
    // When a player cell eats another player cell
    if (node.cellType === 0 && consumer.owner) {
        var killer = consumer.owner;
        var victim = node.owner;

        // 🆕 NEW: Transfer monetary value
        if (victim && victim.authenticated && killer.authenticated) {
            this.handleKillReward(killer, victim, node.mass);
        }
    }

    // ... rest of original code ...
};

// 🆕 NEW: Add this function
GameServer.prototype.handleKillReward = async function(killer, victim, eatenMass) {
    // Calculate transfer amount based on mass eaten
    const victimTotalMass = this.getTotalMass(victim);
    const transferRatio = eatenMass / victimTotalMass;
    const transferAmount = victim.monetaryValue * transferRatio;

    // Apply rake (5% on kills)
    const rakePercentage = 0.05;
    const rake = transferAmount * rakePercentage;
    const netTransfer = transferAmount - rake;

    // Update monetary values
    killer.monetaryValue += netTransfer;
    victim.monetaryValue -= transferAmount;

    // Update kill/death stats
    killer.totalKills++;
    victim.totalDeaths++;

    // Log transaction to database
    await this.db.createTransaction({
        userId: killer.privyId,
        type: 'kill',
        amount: netTransfer,
        fromPlayerId: victim.privyId,
        gameId: this.gameId
    });

    await this.db.createTransaction({
        userId: 'house',
        type: 'rake',
        amount: rake
    });

    // Broadcast monetary update to clients
    this.broadcastMonetaryUpdate(killer, victim);

    console.log(`Kill: ${killer.name} +${netTransfer.toFixed(4)} SOL from ${victim.name}`);

    // Check if victim is eliminated
    if (victim.cells.length === 0) {
        await this.handlePlayerDeath(victim);
    }
};

GameServer.prototype.getTotalMass = function(player) {
    return player.cells.reduce((sum, cell) => sum + cell.mass, 0);
};

GameServer.prototype.handlePlayerDeath = async function(player) {
    console.log(`Player eliminated: ${player.name}, Final value: ${player.monetaryValue.toFixed(4)} SOL`);

    // Log game participation
    await this.db.updateGameParticipation(this.gameId, player.privyId, {
        exitAmount: player.monetaryValue,
        kills: player.totalKills,
        deaths: player.totalDeaths,
        leftAt: new Date()
    });

    // Update user balance in database
    await this.db.updateUserBalance(player.privyId, player.monetaryValue);

    // Remove player from game
    this.clients.splice(this.clients.indexOf(player.socket), 1);
};
```

### Step 5: Create Game Server Wrapper

**File:** `backend/src/game/BettingGameServer.ts`

This wraps Ogar3 with our authentication and blockchain:

```typescript
import { PrivyAuthService } from '../auth/PrivyAuth';
import { SolanaService } from '../blockchain/SolanaService';
import { DatabaseService } from '../database/DatabaseService';
import { RateLimiter } from '../security/RateLimiter';
import { BotDetector } from '../security/BotDetector';

// Import Ogar3 (JavaScript)
const Ogar3GameServer = require('./GameServer');

export class BettingGameServer {
  private gameServer: any; // Ogar3 instance
  private privyAuth: PrivyAuthService;
  private solana: SolanaService;
  private db: DatabaseService;
  private rateLimiter: RateLimiter;
  private botDetector: BotDetector;

  constructor() {
    this.privyAuth = new PrivyAuthService();
    this.solana = new SolanaService();
    this.db = new DatabaseService();
    this.rateLimiter = new RateLimiter();
    this.botDetector = new BotDetector(this.db);

    // Initialize Ogar3
    this.gameServer = new Ogar3GameServer();

    // Inject our services into Ogar3
    this.gameServer.db = this.db;
    this.gameServer.solana = this.solana;

    // Override Ogar3's connection handler
    this.setupAuthenticatedConnections();
  }

  private setupAuthenticatedConnections() {
    const originalOnConnection = this.gameServer.onConnection.bind(this.gameServer);

    this.gameServer.onConnection = async (ws: any, req: any) => {
      const clientId = this.generateClientId();

      // Wait for authentication
      ws.once('message', async (data: Buffer) => {
        const message = this.parseMessage(data);

        if (message.type === 'auth') {
          // Verify Privy token
          const user = await this.privyAuth.verifyToken(message.token);

          if (!user) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
            ws.close();
            return;
          }

          // Verify deposit
          if (message.depositSignature) {
            const depositCheck = await this.solana.verifyDeposit(
              message.depositSignature,
              message.depositAmount,
              user.walletAddress
            );

            if (!depositCheck.valid) {
              ws.send(JSON.stringify({ type: 'deposit_error', error: depositCheck.error }));
              ws.close();
              return;
            }

            // Credit user in database
            await this.db.upsertUser(user.privyId, user.walletAddress, user.email);

            // Create player in Ogar3
            const playerTracker = originalOnConnection(ws, req);
            playerTracker.privyId = user.privyId;
            playerTracker.walletAddress = user.walletAddress;
            playerTracker.monetaryValue = depositCheck.amount;
            playerTracker.initialDeposit = depositCheck.amount;
            playerTracker.authenticated = true;

            // Log deposit
            await this.db.createTransaction({
              userId: user.privyId,
              type: 'deposit',
              amount: depositCheck.amount,
              signature: message.depositSignature,
              status: 'confirmed'
            });

            ws.send(JSON.stringify({
              type: 'authenticated',
              monetaryValue: depositCheck.amount,
              privyId: user.privyId
            }));

            console.log(`Player joined: ${user.privyId} with ${depositCheck.amount} SOL`);
          }
        }
      });
    };
  }

  start() {
    this.gameServer.start();
    console.log('Betting Game Server started!');
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(7);
  }

  private parseMessage(data: Buffer): any {
    try {
      return JSON.parse(data.toString());
    } catch {
      return {};
    }
  }
}
```

### Step 6: Update Package.json

**File:** `backend/package.json`

Add Ogar3's dependencies:

```json
{
  "dependencies": {
    "@privy-io/server-auth": "^1.8.0",
    "@solana/web3.js": "^1.87.6",
    "ws": "^8.16.0",
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.1",
    "bcrypt": "^5.1.1",

    // 🆕 Add these for Ogar3
    "serve-static": "^1.15.0",
    "finalhandler": "^1.2.0"
  }
}
```

### Step 7: Create Main Server Entry Point

**File:** `backend/src/index.ts`

```typescript
import dotenv from 'dotenv';
dotenv.config();

import { BettingGameServer } from './game/BettingGameServer';
import { WithdrawalQueue } from './blockchain/WithdrawalQueue';
import { SolanaService } from './blockchain/SolanaService';
import { DatabaseService } from './database/DatabaseService';

async function main() {
  console.log('Starting Agar.io Betting Game Server...');

  // Initialize services
  const db = new DatabaseService();
  const solana = new SolanaService();
  const withdrawalQueue = new WithdrawalQueue(solana, db);

  // Start game server
  const gameServer = new BettingGameServer();
  gameServer.start();

  console.log(`✅ Server running on port ${process.env.PORT || 3001}`);
  console.log(`✅ Game server on port ${process.env.WS_PORT || 3002}`);
}

main().catch(console.error);
```

---

## 🎮 Client-Side Integration

### Step 8: Use Ogar3's Client (with modifications)

**File:** `frontend/src/game/GameClient.ts`

```typescript
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';

export function useGameClient() {
  const { user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  async function joinGame(depositSignature: string, amount: number) {
    const token = await getAccessToken();
    const solanaWallet = wallets.find(w => w.walletClientType === 'solana');

    // Connect to game server (WebSocket)
    const ws = new WebSocket('ws://localhost:3002');

    ws.onopen = () => {
      // Send authentication + deposit proof
      ws.send(JSON.stringify({
        type: 'auth',
        token,
        depositSignature,
        depositAmount: amount
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'authenticated') {
        console.log(`Joined game with ${message.monetaryValue} SOL`);
        // Load Ogar3 client here
        startOgar3Client(ws);
      }
    };
  }

  return { joinGame };
}

function startOgar3Client(ws: WebSocket) {
  // Use Ogar3's existing client code
  // Copy from ogar3_reference/client/
  // Modify to use existing WebSocket connection
}
```

---

## 📝 Testing Checklist

### Local Testing:

1. **Setup Database:**
   ```bash
   psql -U postgres -f backend/schema.sql
   ```

2. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Fill in:
   # - PRIVY_APP_ID
   # - PRIVY_APP_SECRET
   # - SOLANA_RPC_URL (use devnet)
   # - GAME_WALLET_ADDRESS
   # - DATABASE_URL
   ```

4. **Start Server:**
   ```bash
   npm run dev
   ```

5. **Test Flow:**
   - User connects wallet (Privy)
   - User deposits testnet SOL
   - Backend verifies deposit
   - User spawns with monetary value
   - User plays and kills opponent
   - Monetary value transfers
   - User withdraws winnings

---

## 🔒 Security Checklist

Before going live:

- [ ] All player inputs validated server-side
- [ ] Rate limiting on connections
- [ ] Bot detection tracking inputs
- [ ] Double-deposit prevention (signature tracking)
- [ ] SQL injection prevention (parameterized queries)
- [ ] Private keys encrypted
- [ ] HTTPS/WSS only in production
- [ ] Withdrawal limits enforced
- [ ] Transaction logging complete
- [ ] Emergency shutdown procedure tested

---

## 🚀 Deployment

### Production Deployment Steps:

1. **Deploy Database:**
   ```bash
   # Create PostgreSQL on Render.com or Supabase
   # Run schema.sql
   ```

2. **Deploy Game Server:**
   ```bash
   # On Render.com:
   # - Create Web Service
   # - Set build command: npm run build
   # - Set start command: npm start
   # - Add environment variables
   ```

3. **Deploy Frontend:**
   ```bash
   # On Vercel:
   vercel --prod
   ```

4. **Configure Solana:**
   - Switch to mainnet RPC
   - Use production game wallet
   - Enable withdrawal queue

---

## 💡 Quick Start

Want to test it RIGHT NOW?

```bash
# 1. Copy Ogar3 files
cp -r ogar3_reference/entity backend/src/game/entity
cp -r ogar3_reference/gamemodes backend/src/game/gamemodes
cp ogar3_reference/GameServer.js backend/src/game/
cp ogar3_reference/PlayerTracker.js backend/src/game/

# 2. Install dependencies
cd backend
npm install

# 3. Run Ogar3 standalone first (test game works)
cd ../ogar3_reference
npm install
node index.js
# Open http://localhost:80 in browser

# 4. Once game works, integrate with our backend
# Follow steps 2-7 above
```

---

## 📚 Files to Modify (Summary)

| File | Modification | Priority |
|------|--------------|----------|
| `PlayerTracker.js` | Add crypto fields | HIGH |
| `GameServer.js` | Add kill rewards | HIGH |
| `PlayerCell.js` | Add cell value | MEDIUM |
| `BettingGameServer.ts` | NEW - wrapper | HIGH |
| `index.ts` | NEW - entry point | HIGH |
| `package.json` | Add dependencies | HIGH |

---

## 🎯 Next Steps

1. **Test Ogar3 standalone** - Make sure the game works
2. **Copy files to backend/** - Move Ogar3 into our project
3. **Modify PlayerTracker** - Add monetary fields
4. **Modify GameServer** - Add kill rewards
5. **Create BettingGameServer wrapper** - Connect to our auth/blockchain
6. **Test locally** - Full deposit → play → withdraw flow
7. **Deploy** - Render.com + Vercel

---

## 🆘 Common Issues

### Issue: "Cannot find module './entity'"
**Fix:** Copy entity/ folder to backend/src/game/

### Issue: "WebSocket connection failed"
**Fix:** Check ports in .env (WS_PORT=3002)

### Issue: "Deposit verification failed"
**Fix:** Ensure using testnet SOL and correct wallet address

### Issue: "Player not authenticated"
**Fix:** Send auth message before joining game

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ User can deposit testnet SOL
- ✅ User spawns into game with monetary value displayed
- ✅ Killing another player increases your SOL
- ✅ Being killed decreases your SOL
- ✅ User can withdraw remaining balance
- ✅ All transactions logged in database
- ✅ Bot detection catches suspicious behavior

---

**Ready to build! Start with testing Ogar3 standalone, then integrate step by step.** 🚀
