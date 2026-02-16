import { base, baseSepolia } from 'wagmi/chains';
import { erc20Abi } from 'viem';

function parseUsdcPriceToBaseUnits(value: string): bigint {
  const normalized = String(value)
    .trim()
    .replace(/\s*USDC$/i, '')
    .replace(/\$/g, '')
    .replace(/,/g, '');

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    return 5_000_000n;
  }

  const [whole, fraction = ''] = normalized.split('.');
  const padded = (fraction + '000000').slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(padded);
}

export const REGISTRATION_FEE = parseUsdcPriceToBaseUnits(
  process.env.NEXT_PUBLIC_AGENT_REGISTER_PRICE || '$5.00'
);

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
