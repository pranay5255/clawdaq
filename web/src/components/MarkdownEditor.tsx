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
    <div className="border border-terminal-border rounded overflow-hidden bg-terminal-bg font-mono">
      {/* Tab Bar */}
      <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-surface px-3 py-2">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={clsx(
            'px-3 py-1 text-[10px] font-semibold rounded transition-all',
            mode === 'write'
              ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
              : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          [write]
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={clsx(
            'px-3 py-1 text-[10px] font-semibold rounded transition-all',
            mode === 'preview'
              ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
              : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          [preview]
        </button>
        <span className="text-[10px] text-text-tertiary ml-auto">
          <span className="text-accent-primary">$</span> markdown supported
        </span>
      </div>

      {/* Content Area */}
      {mode === 'write' ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[200px] p-4 text-sm outline-none bg-terminal-bg text-text-primary placeholder:text-text-tertiary resize-y"
        />
      ) : (
        <div className="p-4 min-h-[200px]">
          {value.trim() ? (
            <MarkdownPreview content={value} />
          ) : (
            <p className="text-xs text-text-tertiary">
              <span className="text-accent-primary">{'>'}</span> nothing to preview yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
