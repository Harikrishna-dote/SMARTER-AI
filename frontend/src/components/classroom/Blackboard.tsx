import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { MathRenderer } from './MathRenderer';
import { VisualScriptRenderer } from './VisualScriptRenderer';
import type { VisualScriptItem } from '../../lib/types';

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; text: string; diagram: boolean }
  | { kind: 'math'; text: string; block: boolean };

function parseBlocks(content: string): Block[] {
 const blocks: Block[] = [];
 const regex = /(\$\$(.*?)\$\$)|(\$(.*?)\$)|```(\w*)([\s\S]*?)```/g;
 let lastIndex = 0;
 let match;

 while ((match = regex.exec(content)) !== null) {
   if (match.index > lastIndex) {
     const text = content.slice(lastIndex, match.index).trim();
     if (text) {
       blocks.push({ kind: 'paragraph', text });
     }
   }

   if (match[1]) {
     blocks.push({ kind: 'math', text: match[2], block: true });
   } else if (match[3]) {
     blocks.push({ kind: 'math', text: match[4], block: false });
   } else if (match[5]) {
     blocks.push({ kind: 'code', text: match[6], diagram: match[5] === 'diagram' });
   }

   lastIndex = regex.lastIndex;
 }

 if (lastIndex < content.length) {
   const text = content.slice(lastIndex).trim();
   if (text) {
     blocks.push({ kind: 'paragraph', text });
   }
 }

 return blocks;
}

interface BlackboardProps {
 content: string;
 streaming?: boolean;
 topic?: string;
 visualScript?: VisualScriptItem[];
}

export function Blackboard({ content, streaming: _streaming = false, topic: _topic, visualScript }: BlackboardProps) {
 const blocks = useMemo(() => parseBlocks(content), [content]);

 return (
   <div className="h-full flex flex-col gap-4">
     {visualScript && visualScript.length > 0 && (
       <div className="flex-none h-64 border border-brand-400/30 rounded-xl bg-slate-900 overflow-hidden">
         <VisualScriptRenderer script={visualScript} className="h-full w-full" />
       </div>
     )}

     <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 p-2">
       {blocks.map((block, index) => {
         if (block.kind === 'math') {
           return <MathRenderer key={index} math={block.text} block={block.block} />;
         }
         if (block.kind === 'list') {
           return (
             <motion.ul key={index} className="ml-5 list-disc space-y-1 text-slate-100">
               {block.items.map((item, itemIndex) => (
                 <li key={itemIndex}>{item}</li>
               ))}
             </motion.ul>
           );
         }
         return (
           <motion.p key={index} className="leading-relaxed text-slate-100">
             {block.text}
           </motion.p>
         );
       })}
     </div>
   </div>
 );
}
