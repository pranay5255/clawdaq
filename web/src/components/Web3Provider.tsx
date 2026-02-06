'use client';

import { PropsWithChildren, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supportedChains, wagmiConfig } from '@/lib/wagmi';

export default function Web3Provider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={[...supportedChains]}
          theme={darkTheme({
            accentColor: '#00ff9f',
            accentColorForeground: '#04130f',
            borderRadius: 'medium',
            fontStack: 'system'
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
