import { base, baseSepolia } from 'wagmi/chains';
import { erc20Abi } from 'viem';

export const REGISTRATION_FEE = 5_000_000n; // 5 USDC (6 decimals)

export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
};

export const REGISTRY_ADDRESSES: Record<number, string> = {
  [base.id]: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS_SEPOLIA || process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || ''
};

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerAgentWithPayment',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'string' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'isAgentRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'string' }],
    outputs: [{ name: 'registered', type: 'bool' }]
  }
] as const;

export { erc20Abi };

export function getRegistryAddress(chainId: number | undefined) {
  if (!chainId) return '';
  return REGISTRY_ADDRESSES[chainId] || '';
}

export function getUsdcAddress(chainId: number | undefined) {
  if (!chainId) return '';
  return USDC_ADDRESSES[chainId] || '';
}
