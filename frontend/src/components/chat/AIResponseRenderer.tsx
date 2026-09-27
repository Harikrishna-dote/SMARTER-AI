import { memo, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js/lib/common';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '../../lib/utils';
import { safeMarkdownUrl } from '../../lib/responseFormatting';

interface AIResponseRendererProps {
  content: string;
  streaming?: boolean;
  compact?: boolean;
  className?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function languageFromClassName(className?: string): string {
  return className?.match(/language-([^\s]+)/)?.[1]?.toLowerCase() ?? '';
}

function highlightedCode(code: string, language: string): string {
  if (!language || code.length > 20000 || !hljs.getLanguage(language)) {
    return escapeHtml(code);
  }

  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}

function CodeRenderer({
  children,
  className,
  ...props
}: {
  children?: ReactNode;
  className?: string;
}) {
  const rawCode = String(children ?? '');
  const language = languageFromClassName(className);
  const isBlock = Boolean(language || rawCode.includes('\n'));
  const code = isBlock ? rawCode.replace(/\n$/, '') : rawCode;
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlightedCode(code, language), [code, language]);

  if (!isBlock) {
    return (
      <code
        className="rounded border border-black/10 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900 dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <figure className="not-prose my-4 overflow-hidden rounded-lg border border-black/10 bg-slate-950 text-slate-100 dark:border-white/10">
      <figcaption className="flex min-h-10 items-center justify-between border-b border-white/10 bg-slate-900 px-3 text-xs text-slate-300">
        <span className="font-medium uppercase tracking-normal">{language || 'code'}</span>
        <button
          type="button"
          className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-slate-200 transition-colors hover:bg-white/10"
          aria-label="Copy code"
          title="Copy code"
          onClick={async () => {
            await navigator.clipboard?.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="m-0 max-w-full overflow-x-auto p-4 text-sm leading-6">
        <code
          className={cn('font-mono', language && `language-${language}`)}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </figure>
  );
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-6 text-2xl font-semibold tracking-normal first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-5 text-xl font-semibold tracking-normal first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-4 text-lg font-semibold tracking-normal first:mt-0" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mt-4 text-base font-semibold tracking-normal first:mt-0" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="my-3 leading-7 first:mt-0 last:mb-0" {...props}>
      {children}
    </p>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target={href?.startsWith('#') ? undefined : '_blank'}
      rel={href?.startsWith('#') ? undefined : 'noreferrer'}
      className="font-medium text-brand-700 underline decoration-brand-400/50 underline-offset-4 hover:text-brand-600 dark:text-brand-300"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-4 border-l-4 border-brand-400 bg-brand-50/70 px-4 py-2 text-slate-700 dark:bg-brand-400/10 dark:text-slate-200" {...props}>
      {children}
    </blockquote>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-3 list-disc space-y-1 pl-6" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 leading-7" {...props}>
      {children}
    </li>
  ),
  table: ({ children, ...props }) => (
    <div className="not-prose my-4 max-w-full overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="min-w-full border-collapse text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-slate-100" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b border-black/10 px-3 py-2 font-semibold dark:border-white/10" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-black/5 px-3 py-2 align-top dark:border-white/10" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="my-6 border-black/10 dark:border-white/10" {...props} />,
  img: ({ alt, src, ...props }) => (
    <img
      alt={alt ?? ''}
      src={src}
      loading="lazy"
      className="my-4 max-h-[520px] w-auto max-w-full rounded-lg border border-black/10 object-contain dark:border-white/10"
      {...props}
    />
  ),
  code: CodeRenderer,
};

function AIResponseRendererBase({ content, streaming = false, compact = false, className }: AIResponseRendererProps) {
  return (
    <div
      className={cn(
        'ai-response prose prose-sm max-w-none break-words text-slate-900 dark:prose-invert dark:text-slate-100',
        compact && 'prose-p:my-2 prose-headings:mt-3',
        className,
      )}
      aria-live={streaming ? 'polite' : undefined}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={markdownComponents}
        urlTransform={safeMarkdownUrl}
      >
        {content || (streaming ? '...' : '')}
      </ReactMarkdown>
    </div>
  );
}

export const AIResponseRenderer = memo(AIResponseRendererBase);
