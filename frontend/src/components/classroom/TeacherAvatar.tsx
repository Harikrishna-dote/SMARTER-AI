import { motion } from 'framer-motion';
import React, { Suspense } from 'react';
import type { AvatarType } from '../../lib/types';
import type { ConversationEmotion } from '../../features/classroom/conversationIntelligence';
import { AvatarEngine } from '../../features/avatar/avatarEngine';

const AvatarScene = React.lazy(() => import('./AvatarScene'));

export type AvatarState =
  | 'idle'
  | 'greeting'
  | 'explaining'
  | 'thinking'
  | 'listening'
  | 'writing'
  | 'pointing'
  | 'celebrating'
  | 'encouraging';

interface PersonaTheme {
  suit: string;
  suitDark: string;
  accent: string;
  hair: string;
  hasGlasses?: boolean;
  skin: string;
}

const THEMES: Record<AvatarType, PersonaTheme> = {
  male_teacher: { suit: '#2b4a7a', suitDark: '#1d3358', accent: '#f4b860', hair: '#3a2c20', skin: '#e7b48a' },
  female_teacher: { suit: '#1f8a8a', suitDark: '#156464', accent: '#ffd1dc', hair: '#4a2f1d', skin: '#e7b48a' },
  professor: { suit: '#6d2b3a', suitDark: '#4a1c27', accent: '#d9b06a', hair: '#cfcfcf', hasGlasses: true, skin: '#e7b48a' },
  school_teacher: { suit: '#2f8f4e', suitDark: '#1f6336', accent: '#ffe08a', hair: '#2c2018', skin: '#e7b48a' },
  friendly_mentor: { suit: '#6d3bd1', suitDark: '#4a2790', accent: '#35c2a1', hair: '#33241a', skin: '#e7b48a' },
  kids_teacher: { suit: '#f0803c', suitDark: '#c85f22', accent: '#ffd23f', hair: '#1f1712', skin: '#e7b48a' },
};

function armAngle(state: AvatarState): number {
  switch (state) {
    case 'pointing':
    case 'writing':
      return -28;
    case 'celebrating':
      return -120;
    case 'greeting':
      return -70;
    case 'explaining':
      return -45;
    default:
      return -8;
  }
}

export function TeacherAvatar({
  persona = 'friendly_mentor',
  state = 'idle',
  speaking = false,
  emotion = 'neutral',
  size = 280,
  mode = '2d',
  engine,
  avatarState,
}: {
  persona?: AvatarType;
  state?: AvatarState;
  speaking?: boolean;
  emotion?: ConversationEmotion;
  size?: number;
  mode?: '2d' | '3d';
  engine?: AvatarEngine;
  avatarState?: ReturnType<AvatarEngine['getState']>;
}) {
  if (mode === '3d' && engine && avatarState) {
    return (
      <div style={{ width: size, height: size * 1.2 }} className="mx-auto">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-400">Loading 3D...</div>}>
          <AvatarScene engine={engine} state={avatarState} cameraMode="teacher_closeup" quality={avatarState.quality} />
        </Suspense>
      </div>
    );
  }

  const theme = THEMES[persona] ?? THEMES.friendly_mentor;
  const arm = armAngle(state);
  const mouthOpen = speaking ? (emotion === 'excited' ? 8 : 6) : state === 'thinking' ? 1 : 3;
  const mouthPath = `M104 140 q16 ${mouthOpen} 32 0 q-16 ${-mouthOpen} -32 0 Z`;
  const eyebrowTilt = emotion === 'confused' ? [-8, 8] : emotion === 'frustrated' ? [5, -5] : [0, 0];
  const eyeOffset = state === 'listening' ? [0, 2, -2, 0] : [0, 1, -1, 0];
  const smileDepth = emotion === 'confident' || emotion === 'excited' ? 16 : emotion === 'frustrated' ? 4 : 12;

  const bobY = state === 'celebrating' ? [0, -18, 0] : state === 'greeting' ? [0, -8, 0] : state === 'explaining' ? [0, -4, 0] : [0, -2, 0];
  const bobDuration = state === 'celebrating' ? 0.4 : state === 'greeting' ? 0.8 : state === 'explaining' ? 2.6 : 3.8;

  const headTilt = state === 'thinking' ? [-2.5, 2.5, -2.5] : state === 'listening' ? [0, -2, 0] : [0, -1.2, 0];
  const headTiltDuration = state === 'thinking' ? 2.2 : state === 'listening' ? 3 : 4.2;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 1.08 }}>
      <motion.div
        className="absolute inset-0"
        animate={{ y: bobY }}
        transition={{ repeat: Infinity, duration: bobDuration, ease: 'easeInOut' }}
        style={{ transformOrigin: 'center bottom' }}
      >
        <svg viewBox="0 0 240 260" className="h-full w-full" role="img" aria-label={`${persona} avatar`}>
          <defs>
            <linearGradient id="suitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.suit} />
              <stop offset="100%" stopColor={theme.suitDark} />
            </linearGradient>
            <radialGradient id="halo" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor={theme.accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="120" cy="120" rx="110" ry="110" fill="url(#halo)" />

          {/* Shoulders / body */}
          <path d="M40 260 Q40 200 120 196 Q200 200 200 260 Z" fill="url(#suitGrad)" />
          <path d="M120 196 L100 240 L120 250 L140 240 Z" fill={theme.accent} opacity="0.9" />

          {/* Arm / hand gesture */}
          <motion.g
            animate={{
              rotate: arm,
              scale: state === 'celebrating' ? [1, 1.15, 1] : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: state === 'celebrating' ? 200 : 120,
              damping: state === 'celebrating' ? 10 : 12,
            }}
            style={{ transformOrigin: '188px 214px' }}
          >
            <rect x="176" y="206" width="22" height="58" rx="11" fill="url(#suitGrad)" />
            <circle cx="187" cy="200" r="13" fill={theme.skin} />
          </motion.g>

          {/* Neck */}
          <rect x="108" y="168" width="24" height="30" rx="10" fill={theme.skin} />

          {/* Head */}
          <motion.g
            animate={{ rotate: headTilt }}
            transition={{ repeat: Infinity, duration: headTiltDuration, ease: 'easeInOut' }}
            style={{ transformOrigin: '120px 120px' }}
          >
            <ellipse cx="120" cy="112" rx="58" ry="64" fill={theme.skin} />
            {/* Hair */}
            <path d="M62 104 Q60 44 120 42 Q180 44 178 104 Q160 70 120 70 Q80 70 62 104 Z" fill={theme.hair} />

            {/* Eyebrows */}
            <motion.rect
              x="88"
              y="96"
              width="22"
              height="5"
              rx="2.5"
              fill={theme.hair}
              opacity="0.8"
              animate={{ rotate: eyebrowTilt[0] }}
              style={{ transformOrigin: '99px 98px' }}
            />
            <motion.rect
              x="130"
              y="96"
              width="22"
              height="5"
              rx="2.5"
              fill={theme.hair}
              opacity="0.8"
              animate={{ rotate: eyebrowTilt[1] }}
              style={{ transformOrigin: '141px 98px' }}
            />

            {/* Eyes (blink) */}
            <motion.g
              animate={{ scaleY: [1, 1, 0.1, 1], x: eyeOffset }}
              transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.92, 0.95, 1] }}
              style={{ transformOrigin: '120px 116px' }}
            >
              <circle cx="99" cy="116" r="7" fill="#1f2937" />
              <circle cx="141" cy="116" r="7" fill="#1f2937" />
              <circle cx="101" cy="114" r="2.2" fill="#fff" />
              <circle cx="143" cy="114" r="2.2" fill="#fff" />
            </motion.g>

            {/* Glasses for professor */}
            {theme.hasGlasses && (
              <g stroke="#1f2937" strokeWidth="2.5" fill="none">
                <circle cx="99" cy="116" r="13" />
                <circle cx="141" cy="116" r="13" />
                <line x1="112" y1="116" x2="128" y2="116" />
              </g>
            )}

            {/* Nose */}
            <path d="M120 122 q6 10 -2 14" stroke="#b9805a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

            {/* Mouth (lip sync via height) */}
            <path d={mouthPath} fill="#a14b54" />
            {/* Smile hint */}
            <path
              d={`M100 150 q20 ${smileDepth} 40 0`}
              stroke="#8a3b44"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
          </motion.g>

          {/* Thinking bubble */}
          {state === 'thinking' && (
            <motion.g
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              transform="translate(170 36)"
            >
              <circle cx="0" cy="0" r="6" fill={theme.accent} />
              <circle cx="-14" cy="12" r="4" fill={theme.accent} />
              <circle cx="-24" cy="22" r="2.5" fill={theme.accent} />
            </motion.g>
          )}

          {/* Celebration sparkles */}
          {state === 'celebrating' && (
            <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3 }} style={{ transformOrigin: '120px 60px' }}>
              {[0, 90, 180, 270].map((a) => (
                <path key={a} transform={`rotate(${a} 120 60)`} d="M120 34 l4 10 l-4 10 l-4 -10 Z" fill={theme.accent} />
              ))}
            </motion.g>
          )}

          {/* Listening waves */}
          {state === 'listening' && (
            <motion.g
              animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.9, 1.1, 0.9] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              style={{ transformOrigin: '120px 60px' }}
            >
              <ellipse cx="120" cy="60" rx="18" ry="10" fill="none" stroke={theme.accent} strokeWidth="2" opacity="0.6" />
            </motion.g>
          )}
        </svg>
      </motion.div>

      {/* Name plate */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold capitalize text-white backdrop-blur">
        {persona.replace(/_/g, ' ')}
      </div>
    </div>
  );
}
