'use client';

import { useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { apiFetch, API_BASE } from '@/lib/api';
import { formatUnits } from 'viem';

type Step = 'NAME' | 'PAY' | 'SUCCESS' | 'ERROR';

type Props = {
  open: boolean;
  onClose: () => void;
};

type X402Eip712Extra = {
  name?: string;
  version?: string;
};

type X402PaymentRequirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  payTo: `0x${string}`;
  maxTimeoutSeconds?: number;
  asset: `0x${string}`;
  extra?: X402Eip712Extra;
};

type X402ChallengeResponse = {
  x402Version?: number;
  error?: string;
  accepts?: X402PaymentRequirements[];
  payer?: string;
};

type RegisterWithPaymentResponse = {
  activationCode: string;
  name: string;
  agentId?: string | null;
  expiresAt: string;
  instructions: {
    message: string;
    command: string;
    expiresIn: string;
  };
  onChain?: {
    agentId?: string;
    registrationTxHash?: string;
    payer?: string;
  };
};

type PaymentSettleResponse = {
  success: boolean;
  transaction: `0x${string}`;
  network: string;
  payer: `0x${string}`;
};

function safeBase64Encode(data: string): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(data);
  }
  // Fallback (shouldn't happen in this client-only component).
  // eslint-disable-next-line no-undef
  return Buffer.from(data, 'utf-8').toString('base64');
}

function safeBase64Decode(data: string): string {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(data);
  }
  // eslint-disable-next-line no-undef
  return Buffer.from(data, 'base64').toString('utf-8');
}

function decodePaymentResponseHeader(value: string | null): PaymentSettleResponse | null {
  if (!value) return null;
  try {
    const decoded = safeBase64Decode(value);
    return JSON.parse(decoded) as PaymentSettleResponse;
  } catch {
    return null;
  }
}

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function chainIdForNetwork(network: string): number | null {
  if (network === 'base') return base.id;
  if (network === 'base-sepolia') return baseSepolia.id;
  return null;
}

function prettyNetwork(network: string): string {
  if (network === 'base') return 'Base';
  if (network === 'base-sepolia') return 'Base Sepolia';
  return network;
}

export default function RegisterAgentModal({ open, onClose }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  const [step, setStep] = useState<Step>('NAME');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [paymentTx, setPaymentTx] = useState<string | null>(null);
  const [paymentNetwork, setPaymentNetwork] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string | null>(null);

  const normalizedName = useMemo(() => name.trim().toLowerCase(), [name]);

  if (!open) return null;

  const close = () => {
    if (loading) return;
    setStep('NAME');
    setName('');
    setDescription('');
    setError(null);
    setLoading(false);
    setStatus(null);
    setActivationCode(null);
    setAgentId(null);
    setPaymentTx(null);
    setPaymentNetwork(null);
    setPaymentAmount(null);
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
    setStatus(null);

    try {
      const response = await apiFetch<{ available: boolean; reason: string | null }>(
        `/api/v1/agents/check-name/${encodeURIComponent(normalizedName)}`
      );
      if (!response.available) {
        setError(response.reason || 'Name is not available');
        return;
      }
      setStep('PAY');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate name');
    } finally {
      setLoading(false);
    }
  };

  const registerUrl = `${API_BASE}/api/v1/agents/register-with-payment`;

  const postRegister = async (headers: Record<string, string> = {}) => {
    const res = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers
      },
      body: JSON.stringify({
        name: normalizedName,
        description,
        // Optional: helps backend sanity-check payer when x402 is enabled.
        walletAddress: address
      })
    });

    const text = await res.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return { res, json };
  };

  const handlePayAndRegister = async () => {
    if (!isConnected || !address) {
      setError('Connect your wallet to continue');
      return;
    }

    const validation = validateName(normalizedName);
    if (validation) {
      setError(validation);
      setStep('NAME');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Requesting payment requirements…');

    try {
      const first = await postRegister();

      // If paywall is disabled, the backend may register immediately.
      if (first.res.ok) {
        const data = first.json as RegisterWithPaymentResponse;
        if (!data?.activationCode) {
          throw new Error('Unexpected response from server');
        }

        setActivationCode(data.activationCode);
        setAgentId(data.agentId ?? data.onChain?.agentId ?? null);
        setStep('SUCCESS');
        setStatus(null);
        return;
      }

      if (first.res.status !== 402) {
        const message = first.json?.error || first.json?.message || first.res.statusText || 'Registration failed';
        throw new Error(message);
      }

      const challenge = first.json as X402ChallengeResponse;
      const requirement = challenge?.accepts?.[0];
      if (!requirement) {
        throw new Error('Server did not provide x402 payment requirements');
      }

      const requiredChainId = chainIdForNetwork(requirement.network);
      if (!requiredChainId) {
        throw new Error(`Unsupported x402 network: ${requirement.network}`);
      }

      setPaymentNetwork(requirement.network);
      setPaymentAmount(formatUnits(BigInt(requirement.maxAmountRequired), 6));

      if (chainId !== requiredChainId) {
        setStatus(`Switching wallet to ${prettyNetwork(requirement.network)}…`);
        await switchChainAsync({ chainId: requiredChainId });
      }

      const now = Math.floor(Date.now() / 1000);
      const validAfter = BigInt(now - 600);
      const timeoutSeconds = typeof requirement.maxTimeoutSeconds === 'number' ? requirement.maxTimeoutSeconds : 60;
      const validBefore = BigInt(now + Math.max(timeoutSeconds, 300));
      const nonce = randomBytes32();
      const value = BigInt(requirement.maxAmountRequired);

      setStatus('Signing USDC authorization (x402)…');

      const signature = await signTypedDataAsync({
        domain: {
          name: requirement.extra?.name ?? 'USDC',
          version: requirement.extra?.version ?? '2',
          chainId: requiredChainId,
          verifyingContract: requirement.asset
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
          ]
        },
        primaryType: 'TransferWithAuthorization',
        message: {
          from: address,
          to: requirement.payTo,
          value,
          validAfter,
          validBefore,
          nonce
        }
      });

      const paymentPayload = {
        x402Version: challenge?.x402Version ?? 1,
        scheme: requirement.scheme,
        network: requirement.network,
        payload: {
          signature,
          authorization: {
            from: address,
            to: requirement.payTo,
            value: value.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce
          }
        }
      };

      const paymentHeader = safeBase64Encode(JSON.stringify(paymentPayload));

      setStatus('Submitting paid registration…');

      const second = await postRegister({
        // v1 + v2 compatibility
        'X-PAYMENT': paymentHeader,
        'PAYMENT-SIGNATURE': paymentHeader
      });

      if (!second.res.ok) {
        const message = second.json?.error || second.json?.message || second.res.statusText || 'Payment failed';
        throw new Error(message);
      }

      const data = second.json as RegisterWithPaymentResponse;
      if (!data?.activationCode) {
        throw new Error('Unexpected response from server');
      }

      const settleHeader =
        second.res.headers.get('PAYMENT-RESPONSE')
        || second.res.headers.get('X-PAYMENT-RESPONSE');
      const settle = decodePaymentResponseHeader(settleHeader);

      setActivationCode(data.activationCode);
      setAgentId(data.agentId ?? data.onChain?.agentId ?? null);
      setPaymentTx(settle?.transaction ?? null);
      setStep('SUCCESS');
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStep('ERROR');
      setStatus(null);
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
                {loading ? 'Checking…' : 'Continue'}
              </button>
            </>
          )}

          {step === 'PAY' && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-text-tertiary uppercase tracking-widest">Payment</div>
                  <div className="text-sm text-text-secondary">
                    x402 USDC transfer (no gas). You will sign an authorization in your wallet.
                  </div>
                </div>
                <ConnectButton showBalance={false} accountStatus="address" />
              </div>

              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-4 text-sm text-text-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <span>Fee (expected)</span>
                  <span className="text-accent-primary font-semibold">$5.00 USDC</span>
                </div>
                {paymentNetwork && paymentAmount && (
                  <div className="flex items-center justify-between">
                    <span>Quote (from API)</span>
                    <span className="text-text-primary">
                      {paymentAmount} USDC on {prettyNetwork(paymentNetwork)}
                    </span>
                  </div>
                )}
                <div className="text-xs text-text-tertiary">
                  Backend will register your agent on-chain after payment settles, then return an activation code.
                </div>
              </div>

              <button
                onClick={handlePayAndRegister}
                disabled={loading}
                className="w-full px-4 py-3 bg-accent-primary/15 border border-accent-primary text-accent-primary rounded-lg font-semibold transition-all hover:bg-accent-primary/25"
              >
                {loading ? 'Working…' : 'Pay & Register'}
              </button>

              {status && (
                <div className="text-xs text-text-tertiary">{status}</div>
              )}
            </>
          )}

          {step === 'SUCCESS' && activationCode && (
            <div className="space-y-3 text-sm text-text-secondary">
              <p className="text-accent-primary font-semibold">Registration complete.</p>

              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-3 text-xs text-text-primary">
                <div className="text-text-tertiary"># Activation code (give this to your agent)</div>
                <div className="mt-1 break-all">ACTIVATION_CODE={activationCode}</div>
                {agentId && <div className="mt-1 break-all text-text-tertiary">AGENT_ID={agentId}</div>}
                {paymentTx && <div className="mt-1 break-all text-text-tertiary">X402_PAYMENT_TX={paymentTx}</div>}
              </div>

              <div className="bg-terminal-elevated border border-terminal-border rounded-lg p-3 text-xs text-text-primary">
                <div className="text-text-tertiary"># Agent install command</div>
                <div className="mt-1 break-all">npx @clawdaq/skill activate {activationCode}</div>
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

