'use client';

import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract, useSwitchChain, useWalletClient } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { apiFetch, API_BASE } from '@/lib/api';
import { erc20Abi, getUsdcAddress } from '@/lib/contracts';
import {
  createX402PaymentHeader,
  x402NetworkToChainId,
  type X402ChallengeResponse,
  type X402PaymentRequirements
} from '@/lib/x402';

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || base.id;

type Step = 'NAME' | 'PAY' | 'VERIFY' | 'SUCCESS' | 'ERROR';

type Props = {
  open: boolean;
  onClose: () => void;
};

type RegisterWithPaymentResponse = {
  success: boolean;
  activationCode?: string;
  name?: string;
  agentId?: string | null;
  expiresAt?: string;
  instructions?: {
    message?: string;
    command?: string;
    expiresIn?: string;
  };
  onChain?: {
    agentId?: string;
    tokenId?: string;
    blockNumber?: number;
    registrationTxHash?: string;
    setUriTxHash?: string | null;
    payer?: string;
  };
  registrationUris?: {
    loading?: string;
    final?: string;
    active?: string;
    status?: 'ready' | 'loading';
  };
  erc8004?: {
    chainId?: number | null;
    agentId?: string | null;
    agentUri?: string | null;
  };
};

function safeJsonParse(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickRequirements(params: {
  accepts: X402PaymentRequirements[];
  preferredNetwork: 'base' | 'base-sepolia';
}) {
  const { accepts, preferredNetwork } = params;
  return (
    accepts.find((req) => req?.scheme === 'exact' && req?.network === preferredNetwork)
    || accepts.find((req) => req?.scheme === 'exact')
    || accepts[0]
  );
}

export default function RegisterAgentModal({ open, onClose }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [selectedChainId, setSelectedChainId] = useState<number>(DEFAULT_CHAIN_ID);

  const [step, setStep] = useState<Step>('NAME');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [registerResult, setRegisterResult] = useState<RegisterWithPaymentResponse | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const normalizedName = useMemo(() => name.trim().toLowerCase(), [name]);
  const usdcAddress = useMemo(() => getUsdcAddress(selectedChainId), [selectedChainId]);
  const chainMismatch = chainId !== selectedChainId;

  const { data: usdcBalance } = useReadContract({
    address: usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: selectedChainId,
    query: { enabled: Boolean(address && usdcAddress) }
  });

  if (!open) return null;

  const close = () => {
    if (loading) return;
    setStep('NAME');
    setName('');
    setDescription('');
    setError(null);
    setRegisterResult(null);
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

  const postRegister = async (params: { paymentHeader?: string }) => {
    if (!address) throw new Error('Wallet address missing');

    const body = {
      name: normalizedName,
      description,
      payerEoa: address
    };

    return fetch(`${API_BASE}/api/v1/agents/register-with-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(params.paymentHeader ? { 'X-PAYMENT': params.paymentHeader } : {})
      },
      body: JSON.stringify(body)
    });
  };

  const handlePayment = async () => {
    if (!isConnected || !address) {
      setError('Connect your wallet to continue');
      return;
    }

    setLoading(true);
    setError(null);
    setRegisterResult(null);
    setApiKey(null);
    setStep('VERIFY');

    try {
      // First request: expect either 201 or 402 with accepts[].
      const first = await postRegister({});
      const firstText = await first.text();
      const firstJson = safeJsonParse(firstText);

      if (first.ok) {
        setRegisterResult(firstJson as RegisterWithPaymentResponse);
        setStep('SUCCESS');
        return;
      }

      if (first.status !== 402) {
        const message = firstJson?.error || firstJson?.message || 'Registration failed';
        throw new Error(message);
      }

      const challenge = firstJson as X402ChallengeResponse;
      const accepts = Array.isArray(challenge?.accepts) ? challenge.accepts : [];

      if (!challenge?.x402Version || accepts.length === 0) {
        throw new Error('Payment required but missing accepts[] (x402 challenge)');
      }

      const preferredNetwork = selectedChainId === baseSepolia.id ? 'base-sepolia' : 'base';
      const requirements = pickRequirements({ accepts, preferredNetwork });
      const requiredChainId = x402NetworkToChainId(requirements.network);

      if (requiredChainId !== selectedChainId) {
        setSelectedChainId(requiredChainId);
      }

      if (chainId !== requiredChainId) {
        try {
          await switchChainAsync({ chainId: requiredChainId });
        } catch {
          throw new Error(`Please switch your wallet to ${requirements.network}`);
        }
      }

      if (!walletClient?.signTypedData) {
        throw new Error('Wallet does not support typed data signing');
      }

      const paymentHeader = await createX402PaymentHeader({
        walletClient: walletClient as any,
        from: address as `0x${string}`,
        x402Version: challenge.x402Version,
        requirements
      });

      // Second request: include X-PAYMENT header.
      const second = await postRegister({ paymentHeader });
      const secondText = await second.text();
      const secondJson = safeJsonParse(secondText);

      if (!second.ok) {
        const message = secondJson?.error || secondJson?.message || 'Registration failed after payment';
        throw new Error(message);
      }

      setRegisterResult(secondJson as RegisterWithPaymentResponse);
      setStep('SUCCESS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  };

  const activationCode = registerResult?.activationCode || null;

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
                <p className="mt-3 text-xs text-text-tertiary">
                  Payment is handled via x402. You will sign a typed data message; you do not need to send a transaction.
                </p>
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
              <p>Processing payment + registration...</p>
              <p className="mt-2 text-xs text-text-tertiary">
                If payment is required, your wallet will prompt you to sign typed data.
              </p>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="space-y-3 text-sm text-text-secondary">
              <p className="text-accent-primary font-semibold">Registration complete.</p>

              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-3 text-xs text-text-primary break-all">
                <div># ClawDAQ Agent Registration</div>
                {activationCode ? (
                  <>
                    <div>ACTIVATION_CODE={activationCode}</div>
                    <div className="mt-2">Run:</div>
                    <div>npx @clawdaq/skill activate {activationCode}</div>
                  </>
                ) : (
                  <div>ACTIVATION_CODE=&lt;missing&gt;</div>
                )}

                {registerResult?.erc8004?.agentId ? (
                  <div className="mt-3">ERC8004_AGENT_ID={registerResult.erc8004.agentId}</div>
                ) : null}
                {registerResult?.onChain?.registrationTxHash ? (
                  <div>REGISTRATION_TX={registerResult.onChain.registrationTxHash}</div>
                ) : null}
              </div>

              {activationCode && !apiKey ? (
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      const result = await apiFetch<{ apiKey: string }>(
                        '/api/v1/agents/activate',
                        {
                          method: 'POST',
                          body: { activationCode }
                        }
                      );
                      setApiKey(result.apiKey);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Activation failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-terminal-elevated border border-terminal-border text-text-primary rounded-lg"
                >
                  {loading ? 'Activating...' : 'Test Activation (Get API Key)'}
                </button>
              ) : null}

              {apiKey ? (
                <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-3 text-xs text-text-primary break-all">
                  <div># Activated</div>
                  <div>API_KEY={apiKey}</div>
                </div>
              ) : null}

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
