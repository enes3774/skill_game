const { PrivyClient } = require('@privy-io/server-auth');

class PrivyAuthService {
    constructor() {
        const appId = process.env.PRIVY_APP_ID;
        const appSecret = process.env.PRIVY_APP_SECRET;

        if (!appId || !appSecret) {
            throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
        }

        this.privy = new PrivyClient(appId, appSecret);
    }

    /**
     * Verify JWT token from Privy and extract user info
     */
    async verifyToken(token) {
        try {
            const claims = await this.privy.verifyAuthToken(token);

            // Extract Solana wallet
            let walletAddress = null;
            if (claims.linkedAccounts) {
                const solanaWallet = claims.linkedAccounts.find(
                    account => account.type === 'wallet' && account.chainType === 'solana'
                );
                const anyWallet = claims.linkedAccounts.find(
                    account => account.type === 'wallet'
                );

                walletAddress = (solanaWallet || anyWallet)?.address;
            }

            if (!walletAddress) {
                console.error('No wallet found in Privy token');
                return null;
            }

            return {
                privyId: claims.userId,
                walletAddress: walletAddress.toLowerCase(),
                email: claims.email?.address
            };

        } catch (error) {
            console.error('Privy token verification failed:', error);
            return null;
        }
    }
}

module.exports = { PrivyAuthService };
