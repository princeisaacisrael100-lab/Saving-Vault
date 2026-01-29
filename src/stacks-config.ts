import { AppConfig, UserSession } from '@stacks/connect-react';
import { StacksTestnet } from '@stacks/network';

export const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });
export const network = new StacksTestnet();

// UPDATE THIS ADDRESS AFTER DEPLOYING TO TESTNET
export const CONTRACT_ADDRESS = 'ST3J8N6RRMAXWZXFT450MG6VG19TCME746R2QJW17';
export const CONTRACT_NAME = 'savings-vault';

export const authOptions = {
    appConfig,
    userSession,
    appDetails: {
        name: 'SavingsVault',
        icon: window.location.origin + '/vite.svg',
    },
    manifestPath: '/manifest.json',
    // This automatically supports all Stacks wallets: Xverse, Leather, Asigna, etc.
};

