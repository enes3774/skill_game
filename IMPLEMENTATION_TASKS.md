# Agar.io Skill-Based Betting Game - Implementation Tasks
## Based on DamnBruh Architecture Analysis

---

## Overview

This is a **detailed, actionable task list** for building an Agar.io-style skill-based betting game using the proven architecture from DamnBruh.com.

**Timeline:** 12 weeks | **Team:** 2-3 developers | **Budget:** $50-150/month + dev costs

---

## Phase 1: Foundation & Setup (Week 1)

### 1.1 Project Setup
- [ ] Create Git repository
- [ ] Set up monorepo structure:
  ```
  /frontend     (Next.js)
  /backend      (Node.js game server)
  /contracts    (Solana smart contracts)
  /shared       (TypeScript types for protocol)
  ```
- [ ] Initialize package.json for each package
- [ ] Set up TypeScript configs
- [ ] Install core dependencies

### 1.2 Development Environment
- [ ] Set up local Solana test validator
- [ ] Install Phantom wallet (browser extension)
- [ ] Create development wallets with test SOL
- [ ] Set up hot-reload for frontend
- [ ] Set up nodemon for backend

### 1.3 Documentation
- [ ] Document binary protocol specification
- [ ] Create API documentation template
- [ ] Set up project wiki

**Deliverable:** Working dev environment, project structure

---

## Phase 2: Core Agar.io Game Engine (Weeks 2-3)

### 2.1 Game Physics Engine

**File:** `backend/src/engine/GameEngine.ts`

- [ ] Create `Cell` class:
  ```typescript
  class Cell {
    x: number;
    y: number;
    radius: number;
    mass: number;
    velocity: { x: number; y: number };
    color: string;
    playerId: string;
  }
  ```

- [ ] Implement mass-to-radius conversion:
  ```typescript
  radius = 4 * sqrt(mass)  // Agar.io formula
  ```

- [ ] Implement cell movement:
  - [ ] Mouse following (move toward cursor)
  - [ ] Speed based on size (larger = slower)
  - [ ] Deceleration physics
  - [ ] Multiple cells per player

- [ ] Implement cell splitting:
  - [ ] Split into 2 cells
  - [ ] Launch in direction of cursor
  - [ ] Max 16 cells per player
  - [ ] Minimum mass requirement

- [ ] Implement mass ejection:
  - [ ] Eject small mass projectile
  - [ ] Reduce player mass
  - [ ] Projectile physics

### 2.2 Collision Detection

- [ ] Cell eating logic:
  - [ ] Can only eat cells 25% smaller
  - [ ] Transfer mass on consumption
  - [ ] Remove eaten cell

- [ ] Food pellet collision:
  - [ ] Simple circle collision
  - [ ] Add mass (1 unit per food)

- [ ] Virus collision:
  - [ ] Split cells > 150 mass
  - [ ] Create multiple cells
  - [ ] Explosion effect

- [ ] Boundary collision:
  - [ ] Circular or rectangular world
  - [ ] Bounce off walls or hard stop

### 2.3 World Systems

- [ ] Food spawning:
  - [ ] Spawn 1000-2000 food pellets
  - [ ] Constant respawn rate
  - [ ] Distribute across map
  - [ ] Color randomization

- [ ] Virus spawning:
  - [ ] Spawn 10-20 viruses
  - [ ] Static positions
  - [ ] Respawn when consumed

- [ ] World configuration:
  ```typescript
  const WORLD_CONFIG = {
    width: 14400,
    height: 14400,
    foodCount: 1500,
    virusCount: 15
  };
  ```

**Deliverable:** Working Agar.io physics in Node.js

---

## Phase 3: Binary WebSocket Protocol (Week 3)

### 3.1 Protocol Definition

**File:** `shared/src/protocol.ts`

- [ ] Define message opcodes:
  ```typescript
  enum Opcode {
    GAME_STATE = 1,      // S→C: Full game state
    PLAYER_INPUT = 2,    // C→S: Mouse position, split, eject
    CELL_UPDATE = 3,     // S→C: All cell positions
    FOOD_SPAWN = 4,      // S→C: New food items
    CELL_EATEN = 5,      // S→C: Cell consumed event
    PLAYER_DEATH = 6,    // S→C: Player eliminated
    PING = 18,           // C→S: Latency check
    PONG = 19,           // S→C: Ping response
    JSON_MESSAGE = 255   // ↔: Generic JSON
  }
  ```

### 3.2 Binary Encoding/Decoding

- [ ] Implement `CELL_UPDATE` encoder (server):
  ```typescript
  // Structure: [opcode(1)][timestamp(8)][cellCount(2)]
  //            [cellData(30)...]
  // Per cell: [playerId(4)][x(4)][y(4)][radius(4)]
  //           [mass(4)][monetaryValue(4)][r(1)][g(1)][b(1)][flags(1)]
  ```

- [ ] Implement `CELL_UPDATE` decoder (client)

- [ ] Implement `PLAYER_INPUT` encoder (client):
  ```typescript
  // Structure: [opcode(1)][mouseX(4)][mouseY(4)][flags(1)]
  // Flags: bit0=split, bit1=eject
  ```

- [ ] Implement `PLAYER_INPUT` decoder (server)

- [ ] Create protocol test suite

### 3.3 WebSocket Server

**File:** `backend/src/net/GameServer.ts`

- [ ] Set up WebSocket server (ws library)
- [ ] Handle client connections
- [ ] Handle client disconnections
- [ ] Binary message router
- [ ] Broadcast to all clients
- [ ] Send to specific client

**Deliverable:** Binary protocol working, server can broadcast game state

---

## Phase 4: Real-time Multiplayer (Week 4)

### 4.1 Game Loop

**File:** `backend/src/GameLoop.ts`

- [ ] 60 FPS game loop:
  ```typescript
  setInterval(() => {
    processInputs();
    updatePhysics();
    detectCollisions();
    broadcastState();
  }, 1000 / 60);
  ```

- [ ] Input buffering (handle inputs between ticks)
- [ ] Delta time calculation
- [ ] Performance monitoring

### 4.2 State Synchronization

- [ ] Send full game state on join
- [ ] Send delta updates every frame
- [ ] Handle late-joining players
- [ ] Handle disconnections gracefully

### 4.3 Client Prediction

**File:** `frontend/src/game/ClientEngine.ts`

- [ ] Local prediction of own cells
- [ ] Server reconciliation
- [ ] Interpolation for other players
- [ ] Latency display

### 4.4 Room System

- [ ] Create `Room` class (one game instance)
- [ ] Multiple concurrent rooms
- [ ] Room by betting tier ($1, $5, $20)
- [ ] Max players per room (50-100)
- [ ] Matchmaking queue

**Deliverable:** Multiplayer Agar.io working locally

---

## Phase 5: Frontend Canvas Rendering (Week 5)

### 5.1 Game Renderer

**File:** `frontend/src/game/Renderer.ts`

- [ ] Canvas setup (full screen)
- [ ] Camera system:
  - [ ] Follow player cells
  - [ ] Zoom based on total mass
  - [ ] Smooth interpolation

- [ ] Render food pellets:
  - [ ] Simple circles
  - [ ] Colored dots
  - [ ] Optimized batch rendering

- [ ] Render cells:
  - [ ] Gradient fill
  - [ ] Outline
  - [ ] Smooth edges (anti-aliasing)
  - [ ] Name labels
  - [ ] Monetary value display

- [ ] Render viruses:
  - [ ] Spiky green circles
  - [ ] Pulsing animation

- [ ] Grid background
- [ ] Minimap (optional)

### 5.2 UI/HUD

**File:** `frontend/src/components/GameHUD.tsx`

- [ ] Leaderboard (top 10 players)
- [ ] Current mass display
- [ ] Current SOL value display
- [ ] FPS counter
- [ ] Ping/latency display
- [ ] Chat box
- [ ] Settings menu (toggle grid, etc.)

### 5.3 Performance Optimization

- [ ] Frustum culling (only render visible entities)
- [ ] Object pooling
- [ ] WebGL renderer (if needed)
- [ ] Lazy loading assets

**Deliverable:** Beautiful, smooth game rendering

---

## Phase 6: Authentication with Privy.io (Week 6)

### 6.1 Privy Setup

- [ ] Sign up at privy.io
- [ ] Create app, get API keys
- [ ] Configure allowed wallets (Phantom, MetaMask)
- [ ] Configure social logins (optional: email, Google)

### 6.2 Frontend Integration

**File:** `frontend/src/auth/PrivyProvider.tsx`

- [ ] Install @privy-io/react-auth
- [ ] Wrap app with PrivyProvider:
  ```tsx
  <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}>
    <App />
  </PrivyProvider>
  ```

- [ ] Create login button:
  ```tsx
  const { login, user, authenticated } = usePrivy();
  ```

- [ ] Handle authentication state
- [ ] Get wallet address
- [ ] Get access token (JWT)

### 6.3 Backend Verification

**File:** `backend/src/auth/AuthMiddleware.ts`

- [ ] Install @privy-io/server-auth
- [ ] Verify JWT tokens:
  ```typescript
  const { userId } = await privy.verifyAuthToken(token);
  ```

- [ ] Store user session
- [ ] Link Privy DID to player

**Deliverable:** Users can log in with wallet

---

## Phase 7: Solana Blockchain Integration (Week 7)

### 7.1 Wallet Connection

**File:** `frontend/src/blockchain/SolanaWallet.ts`

- [ ] Install @solana/web3.js
- [ ] Get user's connected wallet (via Privy)
- [ ] Connect to Solana RPC:
  ```typescript
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  );
  ```

- [ ] Display SOL balance

### 7.2 Deposit Flow

**File:** `frontend/src/blockchain/Deposit.ts`

- [ ] Create deposit UI:
  - [ ] Select betting tier ($1, $5, $20)
  - [ ] Show SOL amount
  - [ ] Confirm button

- [ ] Send transaction:
  ```typescript
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: playerWallet.publicKey,
      toPubkey: gameWalletPublicKey,
      lamports: LAMPORTS_PER_SOL * amount
    })
  );
  const signature = await playerWallet.sendTransaction(tx);
  ```

- [ ] Wait for confirmation
- [ ] Send signature to game server
- [ ] Join game with verified deposit

### 7.3 Withdrawal Flow

**File:** `backend/src/blockchain/Withdrawals.ts`

- [ ] Create withdrawal queue
- [ ] Verify player balance
- [ ] Calculate rake (10%)
- [ ] Send SOL from game wallet:
  ```typescript
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: gameWallet.publicKey,
      toPubkey: playerWallet,
      lamports: withdrawAmount
    })
  );
  await sendAndConfirmTransaction(connection, tx, [gameWallet]);
  ```

- [ ] Log transaction in database
- [ ] Show confirmation to user

### 7.4 Transaction Verification

**File:** `backend/src/blockchain/Verifier.ts`

- [ ] Verify deposit transactions:
  ```typescript
  const txInfo = await connection.getTransaction(signature);
  // Verify: to address, amount, confirmation
  ```

- [ ] Prevent double-spending
- [ ] Handle failed transactions
- [ ] Retry logic for network issues

**Deliverable:** Deposit and withdraw SOL working

---

## Phase 8: Betting & Monetary System (Week 8)

### 8.1 Player Monetary State

**File:** `backend/src/game/Player.ts`

- [ ] Add `monetaryValue` field to player:
  ```typescript
  class Player {
    id: string;
    walletAddress: string;
    depositAmount: number;      // Initial deposit
    currentValue: number;       // Current SOL value
    cells: Cell[];
  }
  ```

- [ ] Track monetary value in real-time
- [ ] Display above player cells

### 8.2 Kill Rewards

**File:** `backend/src/game/CombatSystem.ts`

- [ ] On cell eaten:
  ```typescript
  function onCellEaten(eater: Player, victim: Player) {
    // Transfer mass
    eater.totalMass += victim.cellMass;

    // Transfer monetary value
    const transferAmount = victim.cellMass / victim.totalMass
                         * victim.currentValue;
    eater.currentValue += transferAmount * 0.95; // 5% rake
    victim.currentValue -= transferAmount;

    // Check if player eliminated
    if (victim.cells.length === 0) {
      eliminatePlayer(victim);
    }
  }
  ```

- [ ] Broadcast monetary updates
- [ ] Show kill feed

### 8.3 House Rake

**File:** `backend/src/economy/RakeSystem.ts`

- [ ] Track total rake collected
- [ ] Apply rake on:
  - [ ] Withdrawals (10%)
  - [ ] Kills (5% of transferred value)

- [ ] Store rake in house wallet
- [ ] Admin dashboard to track revenue

### 8.4 Betting Tiers

- [ ] Create tier configuration:
  ```typescript
  const TIERS = {
    BRONZE: { buyIn: 0.05, name: '$1 Table' },
    SILVER: { buyIn: 0.25, name: '$5 Table' },
    GOLD: { buyIn: 1.0, name: '$20 Table' }
  };
  ```

- [ ] Separate rooms per tier
- [ ] Enforce tier buy-in amounts

**Deliverable:** Full betting system working

---

## Phase 9: Database & Persistence (Week 9)

### 9.1 Database Setup

- [ ] Set up PostgreSQL (Render or Supabase)
- [ ] Create schema:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    privy_did TEXT UNIQUE,
    wallet_address TEXT,
    username TEXT,
    created_at TIMESTAMP
  );

  CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type TEXT, -- 'deposit', 'withdrawal', 'kill', 'death'
    amount NUMERIC(20, 9),
    signature TEXT,
    created_at TIMESTAMP
  );

  CREATE TABLE games (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    tier TEXT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    initial_value NUMERIC(20, 9),
    final_value NUMERIC(20, 9),
    kills INT,
    survival_time INT
  );

  CREATE TABLE leaderboard (
    user_id UUID REFERENCES users(id),
    total_kills INT,
    total_earnings NUMERIC(20, 9),
    games_played INT,
    win_rate NUMERIC(5, 2)
  );
  ```

### 9.2 Transaction Logging

**File:** `backend/src/db/TransactionLogger.ts`

- [ ] Log all deposits
- [ ] Log all withdrawals
- [ ] Log kill events (monetary transfers)
- [ ] Log rake collection

### 9.3 Game History

**File:** `backend/src/db/GameHistory.ts`

- [ ] Save game start
- [ ] Save game end
- [ ] Calculate stats (kills, survival time, profit)
- [ ] Store replay data (optional)

### 9.4 Leaderboard

**File:** `backend/src/db/Leaderboard.ts`

- [ ] Update on game end
- [ ] Query top players:
  - [ ] By total earnings
  - [ ] By kills
  - [ ] By win rate

- [ ] Expose via API

**Deliverable:** Persistent data, transaction history

---

## Phase 10: Frontend UI Pages (Week 10)

### 10.1 Landing Page

**File:** `frontend/src/pages/index.tsx`

- [ ] Hero section
  - [ ] Catchy headline
  - [ ] Screenshot/video of gameplay
  - [ ] "Play Now" CTA button

- [ ] How it works section
- [ ] Betting tiers display
- [ ] Leaderboard preview
- [ ] FAQ section
- [ ] Footer (ToS, Privacy, Contact)

### 10.2 Lobby Page

**File:** `frontend/src/pages/lobby.tsx`

- [ ] Display betting tiers
- [ ] Show active players per tier
- [ ] User balance display
- [ ] Deposit button
- [ ] "Join Game" buttons
- [ ] User profile dropdown

### 10.3 Game Page

**File:** `frontend/src/pages/game.tsx`

- [ ] Full-screen canvas
- [ ] Game HUD overlay
- [ ] Chat panel (collapsible)
- [ ] Settings menu
- [ ] Exit game button (with confirmation)

### 10.4 Profile Page

**File:** `frontend/src/pages/profile.tsx`

- [ ] User stats:
  - [ ] Total games played
  - [ ] Total earnings
  - [ ] Win rate
  - [ ] Average survival time

- [ ] Transaction history table
- [ ] Game history table
- [ ] Withdraw button

### 10.5 Leaderboard Page

**File:** `frontend/src/pages/leaderboard.tsx`

- [ ] Top players table
- [ ] Filter by tier
- [ ] Filter by time period (daily, weekly, all-time)

**Deliverable:** Complete user-facing UI

---

## Phase 11: Security & Anti-Cheat (Week 11)

### 11.1 Server-Side Validation

**File:** `backend/src/security/ValidationEngine.ts`

- [ ] Validate all player inputs:
  - [ ] Mouse position within bounds
  - [ ] Split cooldown enforcement
  - [ ] Eject rate limiting

- [ ] Recalculate all physics server-side
- [ ] Never trust client position

### 11.2 Bot Detection

**File:** `backend/src/security/BotDetection.ts`

- [ ] Track player behavior:
  - [ ] Mouse movement patterns
  - [ ] Reaction times
  - [ ] Decision consistency

- [ ] Flag suspicious accounts
- [ ] CAPTCHA on login
- [ ] Manual review system

### 11.3 Rate Limiting

**File:** `backend/src/security/RateLimiter.ts`

- [ ] Limit WebSocket messages per second
- [ ] Limit API requests per IP
- [ ] Limit login attempts
- [ ] DDoS protection (Cloudflare)

### 11.4 Transaction Security

- [ ] Verify all Solana transactions
- [ ] Prevent double-deposits
- [ ] Withdrawal limits (e.g., max $1000/day)
- [ ] Manual review for large withdrawals

### 11.5 Audit & Testing

- [ ] Penetration testing
- [ ] Smart contract audit (if using custom contracts)
- [ ] Bug bounty program
- [ ] Insurance fund for exploits

**Deliverable:** Secure, cheat-resistant system

---

## Phase 12: Testing & QA (Week 11-12)

### 12.1 Unit Tests

- [ ] Game engine tests (physics, collisions)
- [ ] Protocol encoding/decoding tests
- [ ] Monetary calculation tests
- [ ] Database query tests

### 12.2 Integration Tests

- [ ] End-to-end deposit flow
- [ ] End-to-end withdrawal flow
- [ ] Multiplayer game simulation
- [ ] Kill reward distribution

### 12.3 Load Testing

**File:** `backend/tests/load/LoadTest.ts`

- [ ] Simulate 100+ concurrent players
- [ ] Measure server FPS
- [ ] Measure bandwidth usage
- [ ] Identify bottlenecks

### 12.4 Manual QA

- [ ] Play test with real users
- [ ] Test on different devices (desktop, mobile, tablet)
- [ ] Test different browsers
- [ ] Test different wallets

**Deliverable:** Stable, tested system

---

## Phase 13: Deployment (Week 12)

### 13.1 Production Setup

- [ ] Domain name registration
- [ ] SSL certificate
- [ ] Cloudflare CDN setup

### 13.2 Frontend Deployment

- [ ] Deploy Next.js to Vercel:
  ```bash
  vercel --prod
  ```

- [ ] Configure environment variables
- [ ] Set up custom domain

### 13.3 Backend Deployment

- [ ] Deploy game server to Render.com:
  - [ ] Create 3 instances (US-East, US-West, EU)
  - [ ] Set up WebSocket support
  - [ ] Configure auto-scaling

- [ ] Set up environment variables
- [ ] Configure health checks

### 13.4 Database Deployment

- [ ] Deploy PostgreSQL to Render or Supabase
- [ ] Set up automated backups
- [ ] Configure connection pooling

### 13.5 Monitoring

- [ ] Set up Sentry for error tracking
- [ ] Set up Datadog/CloudWatch for metrics:
  - [ ] Server FPS
  - [ ] Active players
  - [ ] Bandwidth usage
  - [ ] Transaction success rate

- [ ] Set up alerts for:
  - [ ] Server downtime
  - [ ] High error rate
  - [ ] Low balance in game wallet

**Deliverable:** Production-ready deployment

---

## Phase 14: Launch Preparation (Week 12+)

### 14.1 Legal

- [ ] Consult with lawyer on gambling regulations
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Age verification (18+/21+)
- [ ] Determine allowed jurisdictions

### 14.2 Marketing

- [ ] Create social media accounts:
  - [ ] Twitter
  - [ ] Discord server
  - [ ] Reddit

- [ ] Create promotional materials:
  - [ ] Gameplay trailer
  - [ ] Screenshots
  - [ ] Infographics

- [ ] Beta testing program:
  - [ ] Invite crypto influencers
  - [ ] Invite Agar.io communities
  - [ ] Collect feedback

- [ ] Launch campaign:
  - [ ] Twitter ads
  - [ ] Reddit posts
  - [ ] Crypto Discord channels
  - [ ] Partner with streamers

### 14.3 Customer Support

- [ ] Set up support email
- [ ] Create FAQ page
- [ ] Discord community management
- [ ] Ticket system (optional)

**Deliverable:** Public launch

---

## Success Metrics

Track these KPIs:

- **Daily Active Users (DAU)**
- **Total Games Played**
- **Total Volume (SOL wagered)**
- **Average Game Duration**
- **Player Retention (D1, D7, D30)**
- **Revenue (Total Rake Collected)**
- **Customer Acquisition Cost (CAC)**
- **Lifetime Value (LTV)**

---

## Post-Launch Roadmap

### Features to Add Later:

1. **Mobile App** (React Native or PWA)
2. **Custom Skins** (NFTs or purchasable)
3. **Tournaments** (scheduled high-stakes events)
4. **Team Mode** (2v2, 3v3)
5. **Experimental Modes** (shrinking map, mega viruses, etc.)
6. **Referral Program** (invite friends, earn commission)
7. **Achievements & Badges**
8. **Live Streaming Integration** (Twitch overlay)
9. **Multi-Blockchain Support** (Ethereum, Polygon)
10. **DAO Governance** (let players vote on features)

---

## Estimated Costs

### Development:
- **2 Developers × 12 weeks × $5k/week = $120k**
- Or solo dev = 24 weeks = free if you're the dev!

### Infrastructure (Monthly):
- Render game servers: $75
- Vercel frontend: $20
- Database: $25
- Domain + CDN: $20
- **Total: ~$140/month**

### Blockchain Fees:
- Solana transactions: ~$5/month (negligible)

### Marketing:
- $1k-10k initial push

---

## Expected ROI

**Conservative:**
- 100 daily active users
- 5 games per user = 500 games/day
- $5 average buy-in
- 10% rake
- **Revenue: $250/day = $7,500/month**

**Optimistic:**
- 1000 DAU
- $2,500/day = **$75,000/month**

**ROI:** 50x-500x infrastructure costs

---

## Final Checklist Before Launch

- [ ] All tests passing
- [ ] Security audit complete
- [ ] Legal review done
- [ ] Terms of Service live
- [ ] Privacy Policy live
- [ ] Game wallet funded (float for withdrawals)
- [ ] Monitoring dashboards set up
- [ ] Customer support ready
- [ ] Marketing materials ready
- [ ] Beta testing complete
- [ ] Domain configured
- [ ] SSL certificate active
- [ ] Backups configured
- [ ] Incident response plan documented

---

## Conclusion

This task list provides a **step-by-step roadmap** to build a production-ready Agar.io betting game using DamnBruh's proven architecture.

**Key Success Factors:**
1. Binary protocol for performance
2. Server-authoritative for security
3. Privy for easy auth
4. Solana for low fees
5. Focus on mobile optimization

**Start with Phase 1 and work sequentially. Good luck!**
