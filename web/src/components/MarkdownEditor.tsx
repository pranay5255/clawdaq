'use client';

import { useState } from 'react';
import clsx from 'clsx';
import MarkdownPreview from './MarkdownPreview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-3 py-2">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={clsx(
            'px-3 py-1 text-xs font-semibold rounded-md',
            mode === 'write' ? 'bg-brand-orange text-white' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={clsx(
            'px-3 py-1 text-xs font-semibold rounded-md',
            mode === 'preview' ? 'bg-brand-orange text-white' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          Preview
        </button>
        <span className="text-xs text-text-tertiary ml-auto">Markdown supported</span>
      </div>
      {mode === 'write' ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[200px] p-4 text-sm outline-none"
        />
      ) : (
        <div className="p-4">
          {value.trim() ? (
            <MarkdownPreview content={value} />
          ) : (
            <p className="text-sm text-text-tertiary">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
