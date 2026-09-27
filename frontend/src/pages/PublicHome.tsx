import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  MessageSquare,
  Languages,
  FileText,
  Brain,
  Bot,
  GalleryVerticalEnd,
  ArrowRight,
  Zap,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GlassCard, Badge } from '../components/ui/primitives';

const features = [
  { icon: MessageSquare, title: 'Adaptive AI Tutor', desc: 'Real-time, personalized tutoring that adapts to your performance.' },
  { icon: Languages, title: 'Multilingual Translation', desc: 'Translate and refine text across dozens of languages with tone control.' },
  { icon: FileText, title: 'Document Intelligence', desc: 'Upload PDFs and docs, then ask questions grounded in their content.' },
  { icon: Brain, title: 'Persistent Memory', desc: 'The assistant remembers context across every session automatically.' },
  { icon: Bot, title: 'Autonomous Agents', desc: 'Spin up goal-driven agents that chain tools to complete tasks.' },
  { icon: GalleryVerticalEnd, title: 'Vision & OCR', desc: 'Extract text and analyze images, screenshots, and whiteboards.' },
];

const stats = [
  { label: 'Sub-100ms responses', icon: Zap },
  { label: 'End-to-end encrypted', icon: ShieldCheck },
  { label: 'Local + Cloud models', icon: Globe },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function PublicHome() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-white/40 px-5 py-3 backdrop-blur-xl dark:bg-black/30">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient shadow-glow">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">SMARTER AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 text-center sm:pt-28">
        <motion.div initial="hidden" animate="show" variants={container} className="mx-auto max-w-3xl">
          <motion.div variants={item} className="mb-5 flex justify-center">
            <Badge tone="brand" className="px-3 py-1 text-sm">
              <Sparkles size={13} /> Next-generation learning intelligence
            </Badge>
          </motion.div>
          <motion.h1
            variants={item}
            className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
          >
            Learn faster with your <span className="text-gradient">AI tutor</span> that thinks with you
          </motion.h1>
          <motion.p variants={item} className="mx-auto mt-5 max-w-xl text-base text-slate-500 dark:text-slate-400 sm:text-lg">
            Chat, translate, analyze documents, and build autonomous agents — all in one
            ultra-fast, privacy-first workspace.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                Start free
              </Button>
            </Link>
            <Link to="/chat">
              <Button size="lg" variant="secondary">
                Try the tutor
              </Button>
            </Link>
          </motion.div>
          <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <span key={s.label} className="flex items-center gap-1.5">
                  <Icon size={15} className="text-brand-400" />
                  {s.label}
                </span>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Floating glass preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-brand-gradient opacity-20 blur-3xl" />
          <GlassCard strong className="overflow-hidden p-0 text-left">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-coral/70" />
              <span className="h-3 w-3 rounded-full bg-amber/70" />
              <span className="h-3 w-3 rounded-full bg-brand-400/70" />
              <span className="ml-2 text-xs text-slate-400">smarter.ai — tutor session</span>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex justify-end">
                <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-brand-gradient px-4 py-2.5 text-sm text-white">
                  Explain transformers like I’m twelve.
                </div>
              </div>
              <div className="flex">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/60 px-4 py-2.5 text-sm dark:bg-white/5">
                  Think of a transformer like a team of readers. Each word looks at the others to
                  decide what matters most… <span className="text-brand-400">▍</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Everything you need to learn</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">One workspace. Infinite capability.</p>
        </div>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={container}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={item}>
                <GlassCard hover className="h-full p-5">
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand-400/15 text-brand-500">
                    <Icon size={20} />
                  </span>
                  <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <GlassCard strong className="relative overflow-hidden p-8 text-center sm:p-12">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl" />
          <h2 className="font-display text-3xl font-bold tracking-tight">Ready to learn smarter?</h2>
          <p className="mx-auto mt-2 max-w-md text-slate-500 dark:text-slate-400">
            Create your free account and start talking to your AI tutor in seconds.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/register">
              <Button size="lg" rightIcon={<ArrowRight size={18} />}>
                Create your account
              </Button>
            </Link>
          </div>
        </GlassCard>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} SMARTER AI · Built for fast, private, adaptive learning.
      </footer>
    </div>
  );
}
