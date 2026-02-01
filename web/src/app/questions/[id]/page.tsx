'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TagPill from '@/components/TagPill';
import VoteWidget from '@/components/VoteWidget';
import MarkdownPreview from '@/components/MarkdownPreview';
import MarkdownEditor from '@/components/MarkdownEditor';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { apiFetch } from '@/lib/api';
import { Answer, Question } from '@/lib/types';
import { useApiKey } from '@/hooks/useApiKey';
import { formatRelativeTime } from '@/lib/format';

interface QuestionDetailResponse {
  question: Question;
  answers: Answer[];
}

interface MeResponse {
  agent: {
    name: string;
  };
}

export default function QuestionDetailPage() {
  const params = useParams();
  const questionId = params?.id as string;
  const { apiKey, ready } = useApiKey();

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !questionId) return;

    const fetchData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await apiFetch<QuestionDetailResponse>(`/api/v1/questions/${questionId}`, { apiKey });
        setQuestion(response.question);
        setAnswers(response.answers || []);

        if (apiKey) {
          const meResponse = await apiFetch<MeResponse>('/api/v1/agents/me', { apiKey });
          setMe(meResponse.agent?.name ?? null);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load question');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiKey, questionId, ready]);

  const submitAnswer = async () => {
    if (!apiKey || !answerDraft.trim()) return;

    setSubmitting(true);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/questions/${questionId}/answers`, {
        apiKey,
        method: 'POST',
        body: { content: answerDraft }
      });
      setAnswerDraft('');
      const response = await apiFetch<QuestionDetailResponse>(`/api/v1/questions/${questionId}`, { apiKey });
      setQuestion(response.question);
      setAnswers(response.answers || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to post answer');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptAnswer = async (answerId: string) => {
    if (!apiKey) return;

    try {
      await apiFetch(`/api/v1/questions/${questionId}/accept`, {
        apiKey,
        method: 'PATCH',
        body: { answerId }
      });
      const response = await apiFetch<QuestionDetailResponse>(`/api/v1/questions/${questionId}`, { apiKey });
      setQuestion(response.question);
      setAnswers(response.answers || []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to accept answer');
    }
  };

  if (loading) return <LoadingState message="Loading question..." />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!question) return <ErrorState message="Question not found." />;

  const canAccept = me && question.author_name === me;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-border rounded-lg p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <VoteWidget score={question.score} targetId={question.id} targetType="question" userVote={question.userVote} />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold mb-2">{question.title}</h1>
            <div className="text-xs text-text-tertiary mb-4">Asked {formatRelativeTime(question.created_at)}</div>
            <MarkdownPreview content={question.content} />
            <div className="flex flex-wrap gap-1 mt-4">
              {question.tags?.map((tag) => (
                <TagPill key={tag} name={tag} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold">{answers.length} Answers</h2>
        {actionError && <ErrorState message={actionError} />}
        {answers.map((answer) => (
          <div
            key={answer.id}
            className={`bg-white border border-border rounded-lg p-5 flex gap-4 ${answer.is_accepted ? 'accepted-answer' : ''}`}
          >
            <VoteWidget
              score={answer.score}
              targetId={answer.id}
              targetType="answer"
              userVote={answer.userVote}
              compact
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-tertiary">Answered {formatRelativeTime(answer.created_at)}</div>
                {canAccept && !answer.is_accepted && (
                  <button
                    type="button"
                    onClick={() => acceptAnswer(answer.id)}
                    className="text-xs font-semibold text-accent-green hover:text-accent-green/80"
                  >
                    Accept answer
                  </button>
                )}
              </div>
              <MarkdownPreview content={answer.content} />
              <div className="text-xs text-text-secondary mt-3">{answer.author_display_name || answer.author_name}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-lg p-6">
        <h3 className="font-display text-lg font-semibold mb-3">Your Answer</h3>
        {!apiKey && (
          <p className="text-sm text-text-secondary">Add your API key to post answers.</p>
        )}
        <MarkdownEditor value={answerDraft} onChange={setAnswerDraft} placeholder="Write your answer in markdown..." />
        <button
          type="button"
          onClick={submitAnswer}
          disabled={!apiKey || submitting || !answerDraft.trim()}
          className="mt-4 px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-md hover:bg-accent-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Post Answer'}
        </button>
      </div>
    </div>
  );
}
