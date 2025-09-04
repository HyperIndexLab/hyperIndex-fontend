'use client';

import '@rainbow-me/rainbowkit/styles.css';

import {
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { fallback, http, WagmiProvider } from 'wagmi'

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
	hashkeyTestnet,
} from 'wagmi/chains';
import { metaMaskWallet, okxWallet } from '@rainbow-me/rainbowkit/wallets';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import { particleWallet, particleGoogleWallet, particleTwitterWallet } from './ParticleWallet';

console.log(process.env.BUILD_ENV, 'process.env.BUILD_ENV');

export const MAINNET_CHAIN_ID = 177;
export const TESTNET_CHAIN_ID = 133;
const hashkeyMainnet = {
	id: MAINNET_CHAIN_ID,
	name: 'Hashkey Mainnet',
	nativeCurrency: {
		decimals: 18,
		name: 'Hashkey',
		symbol: 'HSK',
	},
	rpcUrls: {
		default: {
			http: ['https://mainnet.hsk.xyz'],
		},
		public: {
			http: ['https://mainnet.0xhsk.xyz'],
		}
	},
	blockExplorers: {
		default: {
			name: 'HashKey Chain Explorer',
			url: 'https://explorer.hsk.xyz',
		},
	},
}

const wagmiConfig = getDefaultConfig({
	appName: 'RainbowKit demo',
	projectId: 'YOUR_PROJECT_ID',
	wallets: [
		{
			groupName: 'Recommended',
			wallets: [
				metaMaskWallet, 
				okxWallet,
				particleWallet,
				particleGoogleWallet,
				particleTwitterWallet,
			],
		},
	],
	chains: [
		process.env.BUILD_ENV === 'test' ? hashkeyTestnet : hashkeyMainnet,
	],
	transports: {
		[hashkeyMainnet.id]: fallback([
			http('https://mainnet.hsk.xyz'),
			http('https://mainnet.0xhsk.xyz'),
		]),
		[hashkeyTestnet.id]: fallback([
			http('https://testnet.hsk.xyz'),
		]),
	},
	ssr: true,
});
		
const RainbowKitWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const queryClient = new QueryClient();

	// 自定义一个网络
	// const hashkeyMainnet = {
	// 	id: 10000,
	// 	name: 'Hashkey Mainnet',
	// 	iconUrl: 'https://hashkey.com/favicon.ico',
	// 	nativeCurrency: {
	// 		decimals: 18,
	// 		name: 'Hashkey',
	// 		symbol: 'HK',
	// 	},
	// 	rpcUrls: {
	// 		default: {
	// 			http: ['https://mainnet.hashkey.com'],
	// 		},
	// 	},
	// } as const satisfies Chain;

	return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
					{children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );};

export {
	wagmiConfig
}

export default RainbowKitWrapper;