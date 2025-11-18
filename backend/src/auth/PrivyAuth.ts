import { PrivyClient } from '@privy-io/server-auth';

export interface PrivyUser {
  privyId: string;
  walletAddress: string;
  email?: string;
}

export class PrivyAuthService {
  private privy: PrivyClient;

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
  async verifyToken(token: string): Promise<PrivyUser | null> {
    try {
      const claims = await this.privy.verifyAuthToken(token);

      // Extract wallet address (prefer Solana wallet)
      const wallet = claims.linkedAccounts?.find(
        (account: any) => account.type === 'wallet' && account.chain_type === 'solana'
      ) || claims.linkedAccounts?.find(
        (account: any) => account.type === 'wallet'
      );

      if (!wallet) {
        console.error('No wallet found in Privy token');
        return null;
      }

      return {
        privyId: claims.userId,
        walletAddress: wallet.address.toLowerCase(),
        email: claims.email?.address
      };

    } catch (error) {
      console.error('Privy token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify the user has access to a specific wallet
   */
  async verifyWalletOwnership(
    privyId: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      const user = await this.privy.getUser(privyId);
      const wallets = user.linkedAccounts.filter(
        (account: any) => account.type === 'wallet'
      );

      return wallets.some(
        (wallet: any) => wallet.address.toLowerCase() === walletAddress.toLowerCase()
      );
    } catch (error) {
      console.error('Wallet ownership verification failed:', error);
      return false;
    }
  }
}
