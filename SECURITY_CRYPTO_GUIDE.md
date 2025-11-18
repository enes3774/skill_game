# Security & Crypto Implementation Guide
## For Agar.io Skill-Based Betting Game

This document focuses on the **critical security and cryptocurrency integration** components - the parts that will protect real money and prevent cheating.

---

## 🔐 Part 1: Security Architecture

### 1.1 Server-Authoritative Design (Anti-Cheat Foundation)

**Core Principle:** Client NEVER controls game state, only sends inputs.

```typescript
// ❌ WRONG - Client sends position (exploitable)
socket.emit('move', { x: 100, y: 200, mass: 5000 }); // Can be faked!

// ✅ CORRECT - Client sends input only
socket.emit('input', { mouseX: 500, mouseY: 300, split: false, eject: false });
```

**Server validates and calculates everything:**

```typescript
class GameServer {
  processPlayerInput(playerId: string, input: PlayerInput) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return;

    // Calculate movement based on input
    const targetAngle = Math.atan2(
      input.mouseY - player.y,
      input.mouseX - player.x
    );

    // Limit rotation speed (prevent instant 180° turns)
    const MAX_ROTATION = 0.1; // radians per tick
    player.angle = this.lerp Angle(player.angle, targetAngle, MAX_ROTATION);

    // Calculate speed based on mass (larger = slower)
    const speed = this.calculateSpeed(player.totalMass);

    // Move player
    player.x += Math.cos(player.angle) * speed;
    player.y += Math.sin(player.angle) * speed;

    // Validate boundaries
    if (this.outOfBounds(player)) {
      this.killPlayer(player, 'out_of_bounds');
    }

    // Handle split/eject
    if (input.split && this.canSplit(player)) {
      this.splitPlayer(player);
    }
    if (input.eject && this.canEject(player)) {
      this.ejectMass(player);
    }
  }
}
```

### 1.2 Input Validation & Sanitization

**All inputs must be validated:**

```typescript
interface PlayerInput {
  mouseX: number;
  mouseY: number;
  split: boolean;
  eject: boolean;
  timestamp: number;
}

function validateInput(input: any): PlayerInput | null {
  // Type checking
  if (typeof input !== 'object') return null;

  // Range validation
  const mouseX = Number(input.mouseX);
  const mouseY = Number(input.mouseY);

  if (!isFinite(mouseX) || !isFinite(mouseY)) return null;
  if (Math.abs(mouseX) > 100000 || Math.abs(mouseY) > 100000) return null;

  // Boolean validation
  const split = Boolean(input.split);
  const eject = Boolean(input.eject);

  // Timestamp validation (prevent replay attacks)
  const timestamp = Number(input.timestamp);
  const now = Date.now();
  if (timestamp < now - 5000 || timestamp > now + 1000) {
    return null; // Input too old or from future
  }

  return { mouseX, mouseY, split, eject, timestamp };
}
```

### 1.3 Rate Limiting (DDoS & Abuse Prevention)

**Per-connection rate limits:**

```typescript
class RateLimiter {
  private limits = new Map<string, RateLimit>();

  checkLimit(clientId: string, action: string, maxPerSecond: number): boolean {
    const key = `${clientId}:${action}`;
    const limit = this.limits.get(key) || { count: 0, resetTime: Date.now() + 1000 };

    if (Date.now() > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = Date.now() + 1000;
    }

    if (limit.count >= maxPerSecond) {
      console.warn(`Rate limit exceeded: ${clientId} - ${action}`);
      return false;
    }

    limit.count++;
    this.limits.set(key, limit);
    return true;
  }
}

// Usage in WebSocket handler
ws.on('message', (data) => {
  if (!rateLimiter.checkLimit(clientId, 'message', 60)) {
    // 60 messages per second max
    ws.send(errorMessage('rate_limit_exceeded'));
    return;
  }

  // Process message...
});
```

### 1.4 Bot Detection

**Behavior analysis for automated players:**

```typescript
class BotDetector {
  private playerStats = new Map<string, PlayerBehavior>();

  analyzeBehavior(playerId: string, input: PlayerInput): BotDetectionResult {
    let stats = this.playerStats.get(playerId);
    if (!stats) {
      stats = {
        inputs: [],
        reactionTimes: [],
        mouseMovements: [],
        startTime: Date.now()
      };
      this.playerStats.set(playerId, stats);
    }

    // Track input
    stats.inputs.push(input);

    // Calculate metrics
    const metrics = {
      // Superhuman reaction time
      avgReactionTime: this.calculateAvgReactionTime(stats),

      // Perfect mouse movements (straight lines)
      mouseSmoothness: this.calculateMouseSmoothness(stats),

      // Inhuman consistency
      inputVariance: this.calculateInputVariance(stats),

      // Playing for hours without break
      sessionDuration: Date.now() - stats.startTime,
    };

    // Bot indicators
    const suspicionScore =
      (metrics.avgReactionTime < 50 ? 20 : 0) +  // < 50ms reactions
      (metrics.mouseSmoothness > 0.95 ? 20 : 0) + // Too smooth
      (metrics.inputVariance < 0.1 ? 20 : 0) +    // Too consistent
      (metrics.sessionDuration > 14400000 ? 20 : 0); // > 4 hours straight

    return {
      suspicionScore,
      isLikelyBot: suspicionScore > 40,
      metrics
    };
  }

  private calculateMouseSmoothness(stats: PlayerBehavior): number {
    // Measure how "perfect" mouse movements are
    // Human movements are slightly jagged, bots are perfectly smooth
    const movements = stats.mouseMovements;
    if (movements.length < 10) return 0;

    let smoothness = 0;
    for (let i = 2; i < movements.length; i++) {
      const angle1 = Math.atan2(
        movements[i-1].y - movements[i-2].y,
        movements[i-1].x - movements[i-2].x
      );
      const angle2 = Math.atan2(
        movements[i].y - movements[i-1].y,
        movements[i].x - movements[i-1].x
      );

      const diff = Math.abs(angle1 - angle2);
      if (diff < 0.01) smoothness++; // Very consistent angles
    }

    return smoothness / movements.length;
  }
}
```

### 1.5 Transaction Tampering Prevention

**All monetary operations must be atomic and logged:**

```typescript
class TransactionManager {
  async transferValue(
    fromPlayerId: string,
    toPlayerId: string,
    amount: number,
    reason: string
  ): Promise<TransactionResult> {
    // Start database transaction
    const dbTransaction = await db.beginTransaction();

    try {
      // Lock player records (prevent concurrent modifications)
      const fromPlayer = await db.players.findAndLock(fromPlayerId);
      const toPlayer = await db.players.findAndLock(toPlayerId);

      // Validate sufficient balance
      if (fromPlayer.monetaryValue < amount) {
        await dbTransaction.rollback();
        return { success: false, error: 'insufficient_balance' };
      }

      // Perform transfer
      fromPlayer.monetaryValue -= amount;
      toPlayer.monetaryValue += amount;

      // Log transaction
      await db.transactions.insert({
        id: uuidv4(),
        fromPlayerId,
        toPlayerId,
        amount,
        reason,
        timestamp: Date.now(),
        blockNumber: null, // Set after blockchain confirmation
        signature: null
      });

      // Update player records
      await db.players.update(fromPlayer);
      await db.players.update(toPlayer);

      // Commit transaction
      await dbTransaction.commit();

      // Broadcast update to clients
      this.broadcastMonetaryUpdate(fromPlayerId, fromPlayer.monetaryValue);
      this.broadcastMonetaryUpdate(toPlayerId, toPlayer.monetaryValue);

      return { success: true };

    } catch (error) {
      await dbTransaction.rollback();
      console.error('Transaction failed:', error);
      return { success: false, error: 'transaction_failed' };
    }
  }
}
```

---

## 💰 Part 2: Cryptocurrency Integration (Solana)

### 2.1 Wallet Connection via Privy.io

**Client-side wallet authentication:**

```typescript
// frontend/src/auth/PrivyAuth.tsx
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';

export function WalletConnect() {
  const { login, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const handleConnect = async () => {
    await login();

    if (authenticated && user) {
      // Get Solana wallet
      const solanaWallet = wallets.find(w => w.walletClientType === 'solana');

      if (solanaWallet) {
        // Get JWT token for backend authentication
        const token = await user.getIdToken();

        // Send to backend
        socket.emit('authenticate', {
          token,
          walletAddress: solanaWallet.address
        });
      }
    }
  };

  return (
    <button onClick={handleConnect}>
      {authenticated ? `Connected: ${user.wallet?.address}` : 'Connect Wallet'}
    </button>
  );
}
```

**Backend verification:**

```typescript
// backend/src/auth/PrivyVerification.ts
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function verifyPrivyToken(token: string): Promise<PrivyUser | null> {
  try {
    const verifiedClaims = await privy.verifyAuthToken(token);

    return {
      privyId: verifiedClaims.userId,
      walletAddress: verifiedClaims.wallet?.address,
      email: verifiedClaims.email
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// In WebSocket handler
socket.on('authenticate', async (data) => {
  const user = await verifyPrivyToken(data.token);

  if (!user) {
    socket.emit('auth_error', { message: 'Invalid token' });
    return;
  }

  // Store authenticated session
  sessions.set(socket.id, {
    privyId: user.privyId,
    walletAddress: user.walletAddress,
    authenticated: true
  });

  socket.emit('authenticated', { success: true });
});
```

### 2.2 Solana Deposit Flow

**Client initiates deposit:**

```typescript
// frontend/src/blockchain/Deposit.ts
import { Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallets } from '@privy-io/react-auth';

export async function depositSOL(amount: number, tier: 'bronze' | 'silver' | 'gold') {
  const { wallets } = useWallets();
  const solanaWallet = wallets.find(w => w.walletClientType === 'solana');

  if (!solanaWallet) {
    throw new Error('No Solana wallet connected');
  }

  // Connect to Solana
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);

  // Game escrow wallet (server-controlled)
  const gameWallet = new PublicKey(process.env.NEXT_PUBLIC_GAME_WALLET_ADDRESS!);

  // Create transfer transaction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: solanaWallet.address,
      toPubkey: gameWallet,
      lamports: amount * LAMPORTS_PER_SOL
    })
  );

  // Get recent blockhash
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.feePayer = solanaWallet.address;

  // Sign and send
  const signedTx = await solanaWallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');

  // Send proof to game server
  socket.emit('deposit', {
    signature,
    amount,
    tier,
    walletAddress: solanaWallet.address.toString()
  });

  return signature;
}
```

**Server verifies and credits deposit:**

```typescript
// backend/src/blockchain/DepositVerifier.ts
import { Connection, PublicKey } from '@solana/web3.js';

export class DepositVerifier {
  private connection: Connection;
  private gameWallet: PublicKey;
  private processedSignatures = new Set<string>();

  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL!);
    this.gameWallet = new PublicKey(process.env.GAME_WALLET_ADDRESS!);
  }

  async verifyDeposit(
    signature: string,
    expectedAmount: number,
    expectedSender: string
  ): Promise<DepositVerification> {
    // Prevent double-processing
    if (this.processedSignatures.has(signature)) {
      return { valid: false, error: 'already_processed' };
    }

    try {
      // Fetch transaction from blockchain
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      if (!tx) {
        return { valid: false, error: 'transaction_not_found' };
      }

      // Verify transaction succeeded
      if (tx.meta?.err) {
        return { valid: false, error: 'transaction_failed' };
      }

      // Parse transfer instruction
      const instruction = tx.transaction.message.instructions[0];
      const accountKeys = tx.transaction.message.accountKeys;

      const fromPubkey = accountKeys[instruction.accounts[0]].toString();
      const toPubkey = accountKeys[instruction.accounts[1]].toString();

      // Verify recipient is our game wallet
      if (toPubkey !== this.gameWallet.toString()) {
        return { valid: false, error: 'wrong_recipient' };
      }

      // Verify sender
      if (fromPubkey !== expectedSender) {
        return { valid: false, error: 'wrong_sender' };
      }

      // Verify amount
      const preBalance = tx.meta!.preBalances[1];
      const postBalance = tx.meta!.postBalances[1];
      const actualAmount = (postBalance - preBalance) / LAMPORTS_PER_SOL;

      if (Math.abs(actualAmount - expectedAmount) > 0.0001) {
        return { valid: false, error: 'wrong_amount' };
      }

      // Mark as processed
      this.processedSignatures.add(signature);

      return {
        valid: true,
        amount: actualAmount,
        sender: fromPubkey,
        blockTime: tx.blockTime,
        slot: tx.slot
      };

    } catch (error) {
      console.error('Deposit verification failed:', error);
      return { valid: false, error: 'verification_error' };
    }
  }
}

// In WebSocket handler
socket.on('deposit', async (data) => {
  const session = sessions.get(socket.id);
  if (!session?.authenticated) {
    socket.emit('error', { message: 'Not authenticated' });
    return;
  }

  // Verify deposit on blockchain
  const verification = await depositVerifier.verifyDeposit(
    data.signature,
    data.amount,
    session.walletAddress
  );

  if (!verification.valid) {
    socket.emit('deposit_failed', { error: verification.error });
    return;
  }

  // Credit player account in database
  await db.users.update({
    privyId: session.privyId,
    balance: { increment: verification.amount }
  });

  // Log transaction
  await db.transactions.insert({
    id: uuidv4(),
    userId: session.privyId,
    type: 'deposit',
    amount: verification.amount,
    signature: data.signature,
    blockTime: verification.blockTime,
    timestamp: Date.now()
  });

  socket.emit('deposit_success', {
    amount: verification.amount,
    newBalance: await getUserBalance(session.privyId)
  });
});
```

### 2.3 Withdrawal Flow with Security

**Withdrawal queue system (prevents abuse):**

```typescript
// backend/src/blockchain/WithdrawalQueue.ts
export class WithdrawalQueue {
  private queue: WithdrawalRequest[] = [];
  private processing = false;

  async requestWithdrawal(
    userId: string,
    amount: number,
    destinationWallet: string
  ): Promise<WithdrawalResponse> {
    // Validate user balance
    const user = await db.users.findOne({ privyId: userId });
    if (!user || user.balance < amount) {
      return { success: false, error: 'insufficient_balance' };
    }

    // Minimum withdrawal
    if (amount < 0.01) {
      return { success: false, error: 'amount_too_small' };
    }

    // Daily limit check
    const todayWithdrawals = await db.transactions.sum({
      userId,
      type: 'withdrawal',
      timestamp: { gte: Date.now() - 86400000 } // 24 hours
    });

    if (todayWithdrawals + amount > 10) { // 10 SOL daily limit
      return { success: false, error: 'daily_limit_exceeded' };
    }

    // Calculate rake (house fee)
    const rakePercentage = 0.10; // 10%
    const rake = amount * rakePercentage;
    const netAmount = amount - rake;

    // Deduct from user balance immediately (prevent double withdrawal)
    await db.users.update({
      privyId: userId,
      balance: { decrement: amount }
    });

    // Add to queue
    const request: WithdrawalRequest = {
      id: uuidv4(),
      userId,
      amount: netAmount,
      rake,
      destinationWallet,
      status: 'pending',
      createdAt: Date.now()
    };

    this.queue.push(request);

    // Log pending withdrawal
    await db.transactions.insert({
      id: request.id,
      userId,
      type: 'withdrawal',
      amount,
      status: 'pending',
      destinationWallet,
      timestamp: Date.now()
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
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        // Send SOL from game wallet
        const signature = await this.sendSOL(
          request.destinationWallet,
          request.amount
        );

        // Update database
        await db.transactions.update({
          id: request.id,
          status: 'completed',
          signature,
          completedAt: Date.now()
        });

        // Log rake collection
        await db.transactions.insert({
          id: uuidv4(),
          userId: 'house',
          type: 'rake',
          amount: request.rake,
          relatedWithdrawal: request.id,
          timestamp: Date.now()
        });

        // Notify user
        this.notifyWithdrawalComplete(request.userId, signature);

        // Remove from queue
        this.queue.shift();

      } catch (error) {
        console.error('Withdrawal failed:', error);

        // Refund user
        await db.users.update({
          privyId: request.userId,
          balance: { increment: request.amount + request.rake }
        });

        await db.transactions.update({
          id: request.id,
          status: 'failed',
          error: error.message
        });

        this.queue.shift();
      }

      // Rate limit: 2 seconds between withdrawals
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.processing = false;
  }

  private async sendSOL(
    destinationWallet: string,
    amount: number
  ): Promise<string> {
    const connection = new Connection(process.env.SOLANA_RPC_URL!);

    // Load game wallet keypair (stored securely)
    const gameWalletKeypair = await this.loadGameWalletKeypair();

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: gameWalletKeypair.publicKey,
        toPubkey: new PublicKey(destinationWallet),
        lamports: amount * LAMPORTS_PER_SOL
      })
    );

    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [gameWalletKeypair],
      { commitment: 'confirmed' }
    );

    return signature;
  }
}
```

### 2.4 Smart Contract for Escrow (Optional but Recommended)

**For maximum security, use a Solana smart contract:**

```rust
// Solana program (Rust)
use anchor_lang::prelude::*;

#[program]
pub mod game_escrow {
    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let player = &ctx.accounts.player;

        // Transfer SOL to escrow account
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: player.to_account_info(),
                to: escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // Emit event for backend to detect
        emit!(DepositEvent {
            player: *player.key,
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
        proof: Vec<u8> // Server signature proving win
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let player = &ctx.accounts.player;

        // Verify server signature
        require!(
            verify_server_signature(&proof, player.key, amount),
            ErrorCode::InvalidProof
        );

        // Transfer SOL from escrow to player
        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **player.to_account_info().try_borrow_mut_lamports()? += amount;

        emit!(WithdrawalEvent {
            player: *player.key,
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
```

---

## 🛡️ Part 3: Advanced Security Measures

### 3.1 Secure Game Wallet Management

**Never expose private keys in code:**

```typescript
// backend/src/security/WalletManager.ts
import { Keypair } from '@solana/web3.js';
import { decrypt } from './encryption';

export class SecureWalletManager {
  private keypair: Keypair | null = null;

  async loadGameWallet(): Promise<Keypair> {
    if (this.keypair) return this.keypair;

    // Load encrypted private key from environment
    const encryptedKey = process.env.GAME_WALLET_PRIVATE_KEY_ENCRYPTED!;
    const encryptionPassword = process.env.WALLET_ENCRYPTION_PASSWORD!;

    // Decrypt private key
    const privateKeyBytes = await decrypt(encryptedKey, encryptionPassword);

    // Create keypair
    this.keypair = Keypair.fromSecretKey(privateKeyBytes);

    return this.keypair;
  }

  // Never log or expose this!
  getPublicKey(): string {
    if (!this.keypair) throw new Error('Wallet not loaded');
    return this.keypair.publicKey.toString();
  }
}
```

**Generate and encrypt wallet:**

```bash
# Generate new Solana wallet
solana-keygen new --outfile game-wallet.json

# Encrypt it
openssl enc -aes-256-cbc -salt -in game-wallet.json -out game-wallet.enc -k YOUR_PASSWORD

# Store encrypted version in environment variable
export GAME_WALLET_PRIVATE_KEY_ENCRYPTED=$(cat game-wallet.enc | base64)
export WALLET_ENCRYPTION_PASSWORD="your-secure-password"

# Delete unencrypted file
rm game-wallet.json
```

### 3.2 SQL Injection Prevention

**Use parameterized queries:**

```typescript
// ❌ WRONG - Vulnerable to SQL injection
const result = await db.query(`
  SELECT * FROM users WHERE privyId = '${userId}'
`);

// ✅ CORRECT - Safe parameterized query
const result = await db.query(`
  SELECT * FROM users WHERE privyId = $1
`, [userId]);
```

### 3.3 HTTPS/WSS Only (Encrypted Connections)

```typescript
// backend/src/server.ts
import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const server = https.createServer({
  cert: fs.readFileSync('/path/to/cert.pem'),
  key: fs.readFileSync('/path/to/key.pem')
}, app);

const wss = new WebSocketServer({ server });

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}
```

---

## 📊 Part 4: Monitoring & Logging

### 4.1 Transaction Logging

**Log everything for audit trails:**

```typescript
interface TransactionLog {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'kill' | 'death' | 'rake';
  amount: number;
  signature?: string;
  blockTime?: number;
  fromPlayer?: string;
  toPlayer?: string;
  reason?: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogger {
  async logTransaction(log: TransactionLog) {
    await db.transactions.insert(log);

    // Also log to external service (Datadog, Sentry, etc.)
    await externalLogger.info('transaction', log);

    // If large amount, alert admins
    if (log.amount > 5 && log.type === 'withdrawal') {
      await this.alertAdmins('Large withdrawal', log);
    }
  }
}
```

### 4.2 Real-time Monitoring Dashboard

**Track critical metrics:**

```typescript
class GameMonitor {
  private metrics = {
    activePlayers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalRake: 0,
    suspiciousActivity: 0,
    serverFPS: 60
  };

  updateMetrics() {
    // Send to monitoring service every 10 seconds
    setInterval(() => {
      this.metrics.activePlayers = this.gameServer.getPlayerCount();
      this.metrics.serverFPS = this.gameServer.getCurrentFPS();

      // Send to Datadog/CloudWatch
      monitoring.gauge('game.active_players', this.metrics.activePlayers);
      monitoring.gauge('game.server_fps', this.metrics.serverFPS);

      // Alert if FPS drops below 50
      if (this.metrics.serverFPS < 50) {
        this.alertAdmins('Low server FPS', this.metrics);
      }
    }, 10000);
  }
}
```

---

## 🚨 Part 5: Incident Response

### 5.1 Emergency Shutdown

```typescript
class EmergencyControls {
  private gameActive = true;

  async emergencyShutdown(reason: string) {
    console.error(`EMERGENCY SHUTDOWN: ${reason}`);

    // Stop accepting new players
    this.gameActive = false;

    // Broadcast to all players
    this.broadcast({
      type: 'emergency_shutdown',
      message: 'Game temporarily unavailable. Funds are safe.'
    });

    // Save all player states
    await this.saveAllPlayerStates();

    // Stop withdrawal processing
    withdrawalQueue.pause();

    // Alert admins
    await this.alertAdmins('EMERGENCY SHUTDOWN', { reason });

    // Close all connections
    this.closeAllConnections();
  }

  async resumeOperations() {
    // Verify system integrity
    await this.systemHealthCheck();

    // Resume withdrawal processing
    withdrawalQueue.resume();

    // Allow new players
    this.gameActive = true;

    console.log('Operations resumed');
  }
}
```

---

## ✅ Security Checklist

Before going to production:

- [ ] All inputs validated and sanitized
- [ ] Server-authoritative physics (no client position control)
- [ ] Rate limiting on all endpoints
- [ ] Bot detection implemented
- [ ] Private keys encrypted and never logged
- [ ] HTTPS/WSS only
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize all user inputs)
- [ ] Transaction atomicity (database transactions)
- [ ] Audit logging for all monetary operations
- [ ] Emergency shutdown procedure tested
- [ ] Withdrawal limits and verification
- [ ] Double-deposit prevention
- [ ] Replay attack prevention (timestamp validation)
- [ ] DDoS protection (Cloudflare)
- [ ] Smart contract audit (if using)
- [ ] Penetration testing completed
- [ ] Bug bounty program active
- [ ] Insurance fund allocated
- [ ] Legal review completed

---

**This guide covers the critical security and crypto components. Next, I'll implement the actual backend code with all these measures built in.**
