/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'react-katex' {
  import type { ComponentType } from 'react';

  export const BlockMath: ComponentType<{ math: string; errorColor?: string }>;
  export const InlineMath: ComponentType<{ math: string; errorColor?: string }>;
}
