import { getAddress, toHex } from 'viem';
import { base, baseSepolia } from 'wagmi/chains';

export type X402Network = 'base' | 'base-sepolia';

export type X402PaymentRequirements = {
  scheme: 'exact';
  network: X402Network;
  maxAmountRequired: string; // atomic units as a decimal string
  resource?: string;
  description?: string;
  mimeType?: string;
  payTo: `0x${string}`;
  maxTimeoutSeconds: number;
  asset: `0x${string}`; // USDC contract address
  extra?: {
    name?: string; // EIP-712 domain name
    version?: string; // EIP-712 domain version
  };
};

export type X402ChallengeResponse = {
  x402Version: number;
  error?: unknown;
  accepts?: X402PaymentRequirements[];
  payer?: `0x${string}`;
};

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
} as const;

function getNetworkId(network: X402Network): number {
  // Keep this minimal and explicit: we only use Base + Base Sepolia in ClawDAQ.
  if (network === 'base') return base.id;
  if (network === 'base-sepolia') return baseSepolia.id;
  // Exhaustive guard.
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  throw new Error(`Unsupported x402 network: ${network}`);
}

export function x402NetworkToChainId(network: X402Network): number {
  return getNetworkId(network);
}

function safeBase64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function createNonce(): `0x${string}` {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available');
  }
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

export async function createX402PaymentHeader(params: {
  walletClient: { signTypedData: (args: any) => Promise<`0x${string}`> };
  from: `0x${string}`;
  x402Version: number;
  requirements: X402PaymentRequirements;
}): Promise<string> {
  const { walletClient, from, x402Version, requirements } = params;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(nowSeconds - 600).toString(); // 10 minutes ago
  const validBefore = BigInt(nowSeconds + (requirements.maxTimeoutSeconds || 60)).toString();
  const nonce = createNonce();

  const data = {
    types: authorizationTypes,
    domain: {
      name: requirements.extra?.name,
      version: requirements.extra?.version,
      chainId: getNetworkId(requirements.network),
      verifyingContract: getAddress(requirements.asset)
    },
    primaryType: 'TransferWithAuthorization' as const,
    message: {
      from: getAddress(from),
      to: getAddress(requirements.payTo),
      value: requirements.maxAmountRequired,
      validAfter,
      validBefore,
      nonce
    }
  };

  const signature = await walletClient.signTypedData(data);

  const paymentPayload = {
    x402Version,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      signature,
      authorization: {
        from: getAddress(from),
        to: getAddress(requirements.payTo),
        value: requirements.maxAmountRequired,
        validAfter,
        validBefore,
        nonce
      }
    }
  };

  return safeBase64Encode(JSON.stringify(paymentPayload));
}

