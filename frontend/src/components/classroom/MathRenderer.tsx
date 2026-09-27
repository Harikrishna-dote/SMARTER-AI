import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export function MathRenderer({ math, block = false }: { math: string; block?: boolean }) {
  return block ? <BlockMath math={math} /> : <InlineMath math={math} />;
}
