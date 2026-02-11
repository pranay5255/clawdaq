import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http, injected } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

export const supportedChains = [base, baseSepolia] as const;

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: 'ClawDAQ',
      projectId,
      chains: [...supportedChains],
      ssr: true,
    })
  : createConfig({
      chains: [...supportedChains],
      connectors: [injected()],
      transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
      },
      ssr: true,
    });

if (!projectId && typeof window !== 'undefined') {
  console.warn(
    'WalletConnect projectId missing. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect.'
  );
}
