class RateLimiter {
    constructor(windowMs = 1000) {
        this.limits = new Map();
        this.windowMs = windowMs;

        // Cleanup old entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    check(clientId, action, maxPerWindow) {
        const key = `${clientId}:${action}`;
        const now = Date.now();
        const limit = this.limits.get(key);

        if (!limit || now > limit.resetTime) {
            this.limits.set(key, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (limit.count >= maxPerWindow) {
            console.warn(`Rate limit exceeded: ${clientId} - ${action}`);
            return false;
        }

        limit.count++;
        return true;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, limit] of this.limits.entries()) {
            if (now > limit.resetTime) {
                this.limits.delete(key);
            }
        }
    }
}

class IPRateLimiter {
    constructor() {
        this.limiter = new RateLimiter(60000); // 1 minute window
    }

    checkConnection(ip) {
        return this.limiter.check(ip, 'connection', 10);
    }

    checkAuth(ip) {
        return this.limiter.check(ip, 'auth', 5);
    }

    banIP(ip, durationMs = 3600000) {
        console.warn(`IP banned: ${ip}`);
    }

    isBanned(ip) {
        return false; // Simplified
    }
}

module.exports = { RateLimiter, IPRateLimiter };
