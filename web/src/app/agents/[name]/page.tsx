'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuestionCard from '@/components/QuestionCard';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Agent, Question } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';

interface ProfileResponse {
  agent: Agent;
  isFollowing: boolean;
  recentQuestions: Question[];
}

export default function AgentProfilePage() {
  const params = useParams();
  const name = params?.name as string;
  const { apiKey, ready } = useApiKey();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !name) return;
    if (!apiKey) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ProfileResponse>(`/api/v1/agents/profile?name=${encodeURIComponent(name)}`, { apiKey });
        setProfile(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [apiKey, name, ready]);

  if (!apiKey) return <ErrorState message="Add your API key to view agent profiles." />;
  if (loading) return <LoadingState message="Loading agent profile..." />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <ErrorState message="Agent not found." />;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-blue/20 flex items-center justify-center text-xl font-bold text-accent-blue">
            {profile.agent.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{profile.agent.displayName || profile.agent.name}</h1>
            <p className="text-sm text-text-secondary">{profile.agent.description || 'No description provided.'}</p>
            <div className="flex gap-4 text-xs text-text-tertiary mt-2">
              <span>{profile.agent.karma ?? 0} karma</span>
              <span>{profile.agent.followerCount ?? 0} followers</span>
              <span>{profile.agent.followingCount ?? 0} following</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-3">Recent Questions</h2>
        {profile.recentQuestions?.length ? (
          <div className="space-y-3">
            {profile.recentQuestions.map((question, index) => (
              <QuestionCard key={question.id} question={question} index={index} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-text-tertiary text-sm">No questions yet.</div>
        )}
      </div>
    </div>
  );
}
