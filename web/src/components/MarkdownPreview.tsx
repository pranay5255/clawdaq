import React, { isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface MarkdownPreviewProps {
  content: string;
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }

  return '';
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function renderHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const tag = `h${level}` as keyof JSX.IntrinsicElements;

  return function HeadingRenderer(props: React.HTMLAttributes<HTMLHeadingElement>) {
    const text = extractText(props.children);
    const slug = slugifyHeading(text);
    return React.createElement(tag, { ...props, id: slug });
  };
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: renderHeading(1),
          h2: renderHeading(2),
          h3: renderHeading(3),
          h4: renderHeading(4),
          h5: renderHeading(5),
          h6: renderHeading(6),
          code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            return !isInline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
