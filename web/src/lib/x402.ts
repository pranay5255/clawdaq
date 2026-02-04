import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { createWalletClient, custom } from 'viem';
import { base, baseSepolia, sepolia } from 'viem/chains';

const NETWORKS: Record<string, typeof base> = {
  'eip155:8453': base,
  'eip155:84532': baseSepolia,
  'eip155:11155111': sepolia
};

export type RegisterAuth = {
  chainId: string;
  address: `0x${string}`;
  nonce: string;
  yParity: number | undefined;
  r: `0x${string}`;
  s: `0x${string}`;
};

export function getChainByNetwork(network: string) {
  return NETWORKS[network];
}

export async function createWalletClientForNetwork(network: string) {
  if (!window.ethereum) {
    throw new Error('No wallet provider found');
  }

  const chain = getChainByNetwork(network);
  if (!chain) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return createWalletClient({
    chain,
    transport: custom(window.ethereum)
  });
}

export async function createX402HttpClient(network: string) {
  const walletClient = await createWalletClientForNetwork(network);
  const [address] = await walletClient.getAddresses();

  const signer = {
    address,
    signTypedData: async (args: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => walletClient.signTypedData({ account: address, ...args })
  };

  const client = new x402Client();
  registerExactEvmScheme(client, { signer, networks: [network] });

  return { httpClient: new x402HTTPClient(client), walletClient, address };
}

export async function signErc8004Authorization(
  walletClient: Awaited<ReturnType<typeof createWalletClientForNetwork>>,
  address: `0x${string}`,
  delegateContract: `0x${string}`,
  chainId: number
): Promise<RegisterAuth> {
  const authorization = await walletClient.signAuthorization({
    account: address,
    contractAddress: delegateContract,
    chainId
  });

  return {
    chainId: authorization.chainId.toString(),
    address: authorization.address,
    nonce: authorization.nonce.toString(),
    yParity: authorization.yParity,
    r: authorization.r,
    s: authorization.s
  };
}
