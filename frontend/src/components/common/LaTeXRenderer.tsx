import { InlineMath } from 'react-katex';

export function LaTeXRenderer({ text }: { text: string }) {
  // Split by $...$ to identify LaTeX expressions
  const parts = text.split(/(\$[^\$]+\$)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={index} math={part.slice(1, -1)} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
