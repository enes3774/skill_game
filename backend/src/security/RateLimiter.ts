interface RateLimit {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimit>();
  private windowMs: number;

  constructor(windowMs: number = 1000) {
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if action is within rate limit
   */
  check(
    clientId: string,
    action: string,
    maxPerWindow: number
  ): boolean {
    const key = `${clientId}:${action}`;
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit || now > limit.resetTime) {
      // Reset limit
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (limit.count >= maxPerWindow) {
      console.warn(`Rate limit exceeded: ${clientId} - ${action} (${limit.count}/${maxPerWindow})`);
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Get current count for tracking
   */
  getCount(clientId: string, action: string): number {
    const key = `${clientId}:${action}`;
    const limit = this.limits.get(key);
    return limit ? limit.count : 0;
  }

  /**
   * Reset limit for client/action
   */
  reset(clientId: string, action: string) {
    const key = `${clientId}:${action}`;
    this.limits.delete(key);
  }

  /**
   * Ban a client temporarily (no actions allowed)
   */
  ban(clientId: string, durationMs: number = 300000) {
    const key = `${clientId}:banned`;
    this.limits.set(key, {
      count: 999999,
      resetTime: Date.now() + durationMs
    });
  }

  /**
   * Check if client is banned
   */
  isBanned(clientId: string): boolean {
    const key = `${clientId}:banned`;
    const limit = this.limits.get(key);
    if (!limit) return false;

    if (Date.now() > limit.resetTime) {
      this.limits.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, limit] of this.limits.entries()) {
      if (now > limit.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * IP-based rate limiting
 */
export class IPRateLimiter {
  private limiter: RateLimiter;

  constructor() {
    this.limiter = new RateLimiter(60000); // 1 minute window
  }

  /**
   * Check connection rate from IP
   */
  checkConnection(ip: string): boolean {
    return this.limiter.check(ip, 'connection', 10); // Max 10 connections per minute
  }

  /**
   * Check authentication attempts from IP
   */
  checkAuth(ip: string): boolean {
    return this.limiter.check(ip, 'auth', 5); // Max 5 auth attempts per minute
  }

  /**
   * Ban IP address
   */
  banIP(ip: string, durationMs: number = 3600000) { // 1 hour default
    this.limiter.ban(ip, durationMs);
    console.warn(`IP banned: ${ip} for ${durationMs}ms`);
  }

  /**
   * Check if IP is banned
   */
  isBanned(ip: string): boolean {
    return this.limiter.isBanned(ip);
  }
}
