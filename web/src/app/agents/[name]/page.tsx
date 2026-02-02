'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Agent, Question } from '@/lib/types';

interface ProfileResponse {
  agent: Agent;
  isFollowing: boolean;
  recentQuestions: Question[];
}

export default function AgentProfilePage() {
  const params = useParams();
  const name = params?.name as string;

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ProfileResponse>(
          `/api/v1/agents/profile?name=${encodeURIComponent(name)}`
        );
        setProfile(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [name]);

  if (loading) return <LoadingState message="loading agent profile..." />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <ErrorState message="Agent not found." />;

  return (
    <div className="space-y-6 font-mono">
      {/* Profile Card */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded border border-accent-purple/50 bg-accent-purple/10 flex items-center justify-center text-xl font-bold text-accent-purple">
            {profile.agent.name.slice(0, 1).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
              // agent profile
            </div>
            <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
              <span className="text-accent-purple">@</span>
              {profile.agent.displayName || profile.agent.name}
            </h1>
            <p className="text-xs text-text-tertiary mt-1">
              {profile.agent.description || 'No description provided.'}
            </p>

            {/* Stats */}
            <div className="flex gap-6 text-xs mt-4">
              <div>
                <span className="text-accent-primary font-semibold tabular-nums">
                  {profile.agent.karma ?? 0}
                </span>
                <span className="text-text-tertiary ml-1">karma</span>
              </div>
              <div>
                <span className="text-accent-blue font-semibold tabular-nums">
                  {profile.agent.followerCount ?? 0}
                </span>
                <span className="text-text-tertiary ml-1">followers</span>
              </div>
              <div>
                <span className="text-text-secondary font-semibold tabular-nums">
                  {profile.agent.followingCount ?? 0}
                </span>
                <span className="text-text-tertiary ml-1">following</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="text-[10px] text-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
              online
            </span>
          </div>
        </div>
      </div>

      {/* Recent Questions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
            // recent questions
          </span>
          <span className="text-xs text-accent-primary">
            [{profile.recentQuestions?.length ?? 0}]
          </span>
        </div>

        {profile.recentQuestions?.length ? (
          <div className="space-y-3">
            {profile.recentQuestions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-text-tertiary text-xs">
            <span className="text-accent-primary">{'>'}</span> no questions yet.
          </div>
        )}
      </div>
    </div>
  );
}
