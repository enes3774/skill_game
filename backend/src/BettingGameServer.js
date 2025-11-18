// BettingGameServer - Wraps Ogar3 with Solana betting system
const GameServer = require('./game/GameServer');
const { PrivyAuthService } = require('./auth/PrivyAuth');
const { SolanaService } = require('./blockchain/SolanaService');
const { DatabaseService } = require('./database/DatabaseService');
const { RateLimiter, IPRateLimiter } = require('./security/RateLimiter');
const { BotDetector } = require('./security/BotDetector');
const { WithdrawalQueue } = require('./blockchain/WithdrawalQueue');

class BettingGameServer {
    constructor() {
        console.log('🎮 Initializing Betting Game Server...');

        // Initialize our services
        this.privyAuth = new PrivyAuthService();
        this.solana = new SolanaService();
        this.db = new DatabaseService();
        this.rateLimiter = new RateLimiter(1000); // 1 second window
        this.ipRateLimiter = new IPRateLimiter();
        this.botDetector = new BotDetector(this.db);
        this.withdrawalQueue = new WithdrawalQueue(this.solana, this.db);

        // Initialize Ogar3 game server
        this.gameServer = new GameServer();

        // Inject our services into Ogar3
        this.gameServer.db = this.db;
        this.gameServer.solana = this.solana;
        this.gameServer.gameId = this.generateGameId();

        // Store pending authentications (waiting for deposit)
        this.pendingAuth = new Map();

        // Override Ogar3's WebSocket handler
        this.setupAuthenticatedConnections();

        console.log('✅ Betting Game Server initialized');
    }

    setupAuthenticatedConnections() {
        const originalServerInit = this.gameServer.start.bind(this.gameServer);
        const self = this;

        this.gameServer.start = function() {
            // Call original start
            originalServerInit();

            // Now override the WebSocket server's connection handler
            if (self.gameServer.socketServer) {
                self.overrideWSConnection();
            }
        };
    }

    overrideWSConnection() {
        const originalWsServer = this.gameServer.socketServer;
        const self = this;

        // Intercept 'connection' event
        originalWsServer.on('connection', async function(ws, req) {
            const ip = req.socket.remoteAddress;

            // Check IP rate limit
            if (!self.ipRateLimiter.checkConnection(ip)) {
                console.log(`⛔ Connection rejected: too many from IP ${ip}`);
                ws.close(1008, 'Too many connections');
                return;
            }

            // Wait for authentication message
            ws.once('message', async (data) => {
                try {
                    const message = self.parseMessage(data);

                    if (message.type === 'auth') {
                        await self.handleAuthentication(ws, message, ip, req);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Auth required' }));
                        ws.close();
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Auth failed' }));
                    ws.close();
                }
            });
        });

        console.log('✅ WebSocket connection handler overridden');
    }

    async handleAuthentication(ws, message, ip, req) {
        // Verify Privy token
        const user = await this.privyAuth.verifyToken(message.token);

        if (!user) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
            ws.close();
            return;
        }

        console.log(`🔐 User authenticated: ${user.privyId}`);

        // Verify deposit transaction
        if (message.depositSignature && message.depositAmount) {
            const depositCheck = await this.solana.verifyDeposit(
                message.depositSignature,
                message.depositAmount,
                user.walletAddress
            );

            if (!depositCheck.valid) {
                ws.send(JSON.stringify({
                    type: 'deposit_error',
                    error: depositCheck.error
                }));
                ws.close();
                return;
            }

            console.log(`💰 Deposit verified: ${depositCheck.amount} SOL from ${user.privyId}`);

            // Create/update user in database
            await this.db.upsertUser(user.privyId, user.walletAddress, user.email);

            // Mark signature as processed
            await this.db.markSignatureProcessed(message.depositSignature);

            // Log deposit transaction
            await this.db.createTransaction({
                userId: user.privyId,
                type: 'deposit',
                amount: depositCheck.amount,
                signature: message.depositSignature,
                status: 'confirmed',
                ipAddress: ip
            });

            // Now connect player to Ogar3
            this.connectAuthenticatedPlayer(ws, req, user, depositCheck.amount, message.depositSignature);

        } else {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Deposit required'
            }));
            ws.close();
        }
    }

    connectAuthenticatedPlayer(ws, req, user, depositAmount, signature) {
        // Create PlayerTracker (Ogar3's player object)
        const PlayerTracker = require('./game/PlayerTracker');
        const playerTracker = new PlayerTracker(this.gameServer, ws);

        // Set crypto fields
        playerTracker.privyId = user.privyId;
        playerTracker.walletAddress = user.walletAddress;
        playerTracker.monetaryValue = depositAmount;
        playerTracker.initialDeposit = depositAmount;
        playerTracker.authenticated = true;
        playerTracker.gameId = this.gameServer.gameId;
        playerTracker.depositSignature = signature;
        playerTracker.remoteAddress = req.socket.remoteAddress;

        // Set up PacketHandler for this connection
        const PacketHandler = require('./game/PacketHandler');
        const packetHandler = new PacketHandler(this.gameServer, ws);
        ws.packetHandler = packetHandler;
        ws.playerTracker = playerTracker;

        // Add to game server's client list
        this.gameServer.clients.push(ws);

        // Send success message
        ws.send(JSON.stringify({
            type: 'authenticated',
            monetaryValue: depositAmount,
            privyId: user.privyId,
            playerId: playerTracker.pID
        }));

        console.log(`✅ Player joined: ${user.privyId} with ${depositAmount} SOL (ID: ${playerTracker.pID})`);

        // Set up disconnect handler
        ws.on('close', () => {
            this.handlePlayerDisconnect(playerTracker);
        });
    }

    async handlePlayerDisconnect(player) {
        console.log(`👋 Player disconnected: ${player.name} (${player.privyId})`);

        if (player.authenticated && player.monetaryValue > 0) {
            // Update user balance
            await this.db.updateUserBalance(player.privyId, player.monetaryValue)
                .catch(err => console.error('Failed to update balance on disconnect:', err));

            // Update game participation
            if (player.gameId) {
                await this.db.query(
                    `UPDATE game_participations
                     SET exit_amount = $1, kills = $2, deaths = $3, left_at = NOW()
                     WHERE game_id = $4 AND user_id = (SELECT id FROM users WHERE privy_id = $5)`,
                    [player.monetaryValue, player.totalKills, player.totalDeaths, player.gameId, player.privyId]
                ).catch(err => console.error('Failed to update participation:', err));
            }

            console.log(`💾 Saved ${player.monetaryValue.toFixed(4)} SOL to database for ${player.privyId}`);
        }
    }

    parseMessage(data) {
        try {
            // Try to parse as JSON first
            if (data instanceof Buffer) {
                // Check if it's a text message
                const str = data.toString();
                if (str[0] === '{') {
                    return JSON.parse(str);
                }
            }
            // It's a binary Ogar3 packet, ignore for auth
            return {};
        } catch {
            return {};
        }
    }

    generateGameId() {
        return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    start() {
        console.log('🚀 Starting Betting Game Server...');
        this.gameServer.start();
        console.log('✅ Server running!');
        console.log(`📍 WebSocket: ws://localhost:${this.gameServer.config.serverPort}`);
        console.log(`💰 Rake: ${(parseFloat(process.env.RAKE_PERCENTAGE || '0.05') * 100)}%`);
    }

    getWithdrawalQueue() {
        return this.withdrawalQueue;
    }
}

module.exports = { BettingGameServer };
