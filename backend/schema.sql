-- Database schema for Agar.io betting game

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  username TEXT,
  email TEXT,
  balance NUMERIC(20, 9) DEFAULT 0 NOT NULL,
  total_deposited NUMERIC(20, 9) DEFAULT 0,
  total_withdrawn NUMERIC(20, 9) DEFAULT 0,
  total_rake_paid NUMERIC(20, 9) DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'kill', 'death', 'rake', 'refund')),
  amount NUMERIC(20, 9) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled')),
  signature TEXT UNIQUE, -- Solana transaction signature
  block_time BIGINT, -- Solana block time
  from_player_id UUID REFERENCES users(id),
  to_player_id UUID REFERENCES users(id),
  game_id UUID,
  destination_wallet TEXT,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  winner_id UUID REFERENCES users(id),
  total_players INTEGER DEFAULT 0,
  final_pot NUMERIC(20, 9) DEFAULT 0,
  server_instance TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Game participations table
CREATE TABLE game_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  user_id UUID REFERENCES users(id),
  entry_amount NUMERIC(20, 9) NOT NULL,
  exit_amount NUMERIC(20, 9) DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  max_mass NUMERIC(10, 2) DEFAULT 0,
  survival_time INTEGER DEFAULT 0, -- seconds
  final_rank INTEGER,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(game_id, user_id)
);

-- Withdrawal queue table
CREATE TABLE withdrawal_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount NUMERIC(20, 9) NOT NULL,
  net_amount NUMERIC(20, 9) NOT NULL,
  rake NUMERIC(20, 9) NOT NULL,
  destination_wallet TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  signature TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT positive_amounts CHECK (amount > 0 AND net_amount > 0 AND rake >= 0)
);

-- Suspicious activity log
CREATE TABLE suspicious_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  activity_type TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  data JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT
);

-- Processed signatures (prevent double-spending)
CREATE TABLE processed_signatures (
  signature TEXT PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_privy_id ON users(privy_id);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_signature ON transactions(signature);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_games_tier ON games(tier);
CREATE INDEX idx_games_started_at ON games(started_at DESC);
CREATE INDEX idx_game_participations_user_id ON game_participations(user_id);
CREATE INDEX idx_game_participations_game_id ON game_participations(game_id);
CREATE INDEX idx_withdrawal_queue_status ON withdrawal_queue(status);
CREATE INDEX idx_suspicious_activity_user_id ON suspicious_activity(user_id);
CREATE INDEX idx_suspicious_activity_reviewed ON suspicious_activity(reviewed);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for leaderboard
CREATE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.wallet_address,
  u.games_played,
  u.total_kills,
  u.total_deaths,
  CASE
    WHEN u.total_deaths > 0 THEN ROUND(u.total_kills::NUMERIC / u.total_deaths, 2)
    ELSE u.total_kills
  END as kd_ratio,
  (u.total_withdrawn + u.balance - u.total_deposited) as net_profit,
  CASE
    WHEN u.games_played > 0 THEN ROUND((u.total_withdrawn + u.balance - u.total_deposited) / u.games_played, 4)
    ELSE 0
  END as avg_profit_per_game
FROM users u
WHERE u.games_played > 0 AND NOT u.is_banned
ORDER BY net_profit DESC;

-- View for daily statistics
CREATE VIEW daily_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT CASE WHEN type = 'deposit' THEN user_id END) as unique_depositors,
  COUNT(CASE WHEN type = 'deposit' THEN 1 END) as total_deposits,
  SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposit_volume,
  COUNT(CASE WHEN type = 'withdrawal' THEN 1 END) as total_withdrawals,
  SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END) as withdrawal_volume,
  SUM(CASE WHEN type = 'rake' THEN amount ELSE 0 END) as total_rake
FROM transactions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
