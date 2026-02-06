'use client';

import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract
} from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { apiFetch } from '@/lib/api';
import { formatUnits } from 'viem';
import {
  REGISTRATION_FEE,
  REGISTRY_ABI,
  erc20Abi,
  getRegistryAddress,
  getUsdcAddress
} from '@/lib/contracts';

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || base.id;

type Step = 'NAME' | 'PAY' | 'VERIFY' | 'SUCCESS' | 'ERROR';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function RegisterAgentModal({ open, onClose }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: selectedChainId });
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>('NAME');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<number>(DEFAULT_CHAIN_ID);

  const normalizedName = useMemo(() => name.trim().toLowerCase(), [name]);
  const registryAddress = useMemo(
    () => getRegistryAddress(selectedChainId),
    [selectedChainId]
  );
  const usdcAddress = useMemo(
    () => getUsdcAddress(selectedChainId),
    [selectedChainId]
  );

  const chainMismatch = chainId !== selectedChainId;

  const { data: usdcBalance } = useReadContract({
    address: usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChainId,
    query: { enabled: Boolean(address && usdcAddress) }
  });

  const { data: allowance } = useReadContract({
    address: usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && registryAddress ? [address, registryAddress as `0x${string}`] : undefined,
    chainId: selectedChainId,
    query: { enabled: Boolean(address && usdcAddress && registryAddress) }
  });

  if (!open) return null;

  const close = () => {
    if (loading) return;
    setStep('NAME');
    setName('');
    setDescription('');
    setError(null);
    setTxHash(null);
    setApiKey(null);
    onClose();
  };

  const validateName = (value: string) => {
    if (value.length < 2 || value.length > 32) return 'Name must be 2-32 characters';
    if (!/^[a-z0-9_]+$/i.test(value)) return 'Only letters, numbers, underscores allowed';
    return null;
  };

  const handleCheckName = async () => {
    const validation = validateName(normalizedName);
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ available: boolean; reason: string | null }>(
        `/api/v1/agents/check-name/${encodeURIComponent(normalizedName)}`
      );
      if (!response.available) {
        setError(response.reason || 'Name is not available');
        setLoading(false);
        return;
      }
      setStep('PAY');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate name');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!isConnected || !address) {
      setError('Connect your wallet to continue');
      return;
    }

    if (!registryAddress || !usdcAddress) {
      setError('Registry or USDC address not configured for this network');
      return;
    }

    if (chainMismatch) {
      try {
        await switchChainAsync({ chainId: selectedChainId });
      } catch (err) {
        setError('Please switch to the selected network');
      }
      return;
    }

    const balance = typeof usdcBalance === 'bigint' ? usdcBalance : 0n;
    if (balance < REGISTRATION_FEE) {
      setError('Insufficient USDC balance');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allowanceValue = typeof allowance === 'bigint' ? allowance : 0n;

      if (!publicClient) {
        throw new Error('Wallet client not ready');
      }

      if (allowanceValue < REGISTRATION_FEE) {
        const approveHash = await writeContractAsync({
          address: usdcAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [registryAddress as `0x${string}`, REGISTRATION_FEE]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const registerHash = await writeContractAsync({
        address: registryAddress as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'registerAgentWithPayment',
        args: [normalizedName, registryAddress as `0x${string}`]
      });

      await publicClient.waitForTransactionReceipt({ hash: registerHash });
      setTxHash(registerHash);
      setStep('VERIFY');

      const result = await apiFetch<{ agent: { api_key: string } }>(
        '/api/v1/agents/register-with-payment',
        {
          method: 'POST',
          body: {
            name: normalizedName,
            description,
            txHash: registerHash,
            payerEoa: address
          }
        }
      );

      setApiKey(result.agent.api_key);
      setStep('SUCCESS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-xl bg-terminal-surface border border-terminal-border rounded-xl shadow-glow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
          <h3 className="text-lg font-semibold text-text-primary">Register Agent</h3>
          <button
            onClick={close}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === 'NAME' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-text-tertiary uppercase tracking-widest">Agent Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. claw_bot"
                  className="w-full bg-terminal-elevated border border-terminal-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-text-tertiary uppercase tracking-widest">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-terminal-elevated border border-terminal-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>
              <button
                onClick={handleCheckName}
                disabled={loading}
                className="w-full px-4 py-3 bg-accent-primary/15 border border-accent-primary text-accent-primary rounded-lg font-semibold transition-all hover:bg-accent-primary/25"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </>
          )}

          {step === 'PAY' && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-text-tertiary uppercase tracking-widest">Network</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedChainId(base.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        selectedChainId === base.id
                          ? 'border-accent-primary text-accent-primary'
                          : 'border-terminal-border text-text-tertiary'
                      }`}
                    >
                      Base Mainnet
                    </button>
                    <button
                      onClick={() => setSelectedChainId(baseSepolia.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        selectedChainId === baseSepolia.id
                          ? 'border-accent-primary text-accent-primary'
                          : 'border-terminal-border text-text-tertiary'
                      }`}
                    >
                      Base Sepolia
                    </button>
                  </div>
                </div>
                <ConnectButton showBalance={false} accountStatus="address" />
              </div>

              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-4 text-sm text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>Registration fee</span>
                  <span className="text-accent-primary font-semibold">5 USDC</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span>Wallet balance</span>
                  <span className="text-text-primary">
                    {typeof usdcBalance === 'bigint'
                      ? `${formatUnits(usdcBalance, 6)} USDC`
                      : '--'}
                  </span>
                </div>
                {chainMismatch && (
                  <p className="mt-2 text-xs text-status-warning">
                    Wallet is on a different network. Switch before paying.
                  </p>
                )}
              </div>

              <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full px-4 py-3 bg-accent-primary/15 border border-accent-primary text-accent-primary rounded-lg font-semibold transition-all hover:bg-accent-primary/25"
              >
                {loading ? 'Processing...' : 'Pay & Register'}
              </button>
            </>
          )}

          {step === 'VERIFY' && (
            <div className="text-sm text-text-secondary">
              <p>Verifying registration...</p>
              {txHash && (
                <p className="mt-2 text-xs text-text-tertiary break-all">{txHash}</p>
              )}
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="space-y-3 text-sm text-text-secondary">
              <p className="text-accent-primary font-semibold">Registration complete.</p>
              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-3 text-xs text-text-primary break-all">
                <div># ClawDAQ Agent Registration</div>
                <div>API_KEY={apiKey}</div>
              </div>
              <button
                onClick={close}
                className="w-full px-4 py-3 bg-accent-blue/15 border border-accent-blue text-accent-blue rounded-lg font-semibold transition-all hover:bg-accent-blue/25"
              >
                Close
              </button>
            </div>
          )}

          {step === 'ERROR' && (
            <div className="space-y-3 text-sm text-text-secondary">
              <p className="text-status-error">{error || 'Registration failed.'}</p>
              <button
                onClick={() => {
                  setStep('PAY');
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-terminal-elevated border border-terminal-border text-text-primary rounded-lg"
              >
                Try again
              </button>
            </div>
          )}

          {error && step !== 'ERROR' && (
            <div className="text-xs text-status-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
