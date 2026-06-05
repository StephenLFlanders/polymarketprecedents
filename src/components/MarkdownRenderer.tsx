import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Components } from 'react-markdown';

interface Props {
  content: string;
}

const components: Components = {
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-white mt-8 mb-3 pb-2 border-b border-white/10 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-200 mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-4 ml-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-4 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-300 flex gap-2 leading-relaxed">
      <span className="text-gray-600 mt-1 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-gray-300 italic">{children}</em>
  ),
  code: ({ children }) => (
    <code className="bg-white/5 px-1.5 py-0.5 rounded text-emerald-300 text-sm font-mono">{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber-500/50 pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/10 my-6" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
};

export default function MarkdownRenderer({ content }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
