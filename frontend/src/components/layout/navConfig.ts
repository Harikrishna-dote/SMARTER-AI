import type { Role } from '../../lib/types';

import {
  LayoutDashboard,
  MessageSquare,
  Languages,
  FileText,
  Brain,
  Bot,
  GalleryVerticalEnd,
  Mic,
  Settings,
  ShieldCheck,
  GraduationCap,
  Users,
  FolderKanban,
  CalendarDays,
  Bell,
  Briefcase,
  Code2,
  Paintbrush,
  MessagesSquare,
  Lock,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  adminOnly?: boolean;
  roles?: readonly Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Your learning overview' },
  { to: '/chat', label: 'Chat', icon: MessageSquare, description: 'Talk to your AI tutor' },
  { to: '/classroom', label: 'AI Tutor Classroom', icon: GraduationCap, description: 'Live AI teacher class' },
  { to: '/translate', label: 'Translate', icon: Languages, description: 'Translate & refine text' },
  { to: '/documents', label: 'Documents', icon: FileText, description: 'Upload & query files' },
  { to: '/memory', label: 'Memory', icon: Brain, description: 'Persistent knowledge' },
  { to: '/agents', label: 'Agents', icon: Bot, description: 'Automated workflows' },
  { to: '/vision', label: 'Vision', icon: GalleryVerticalEnd, description: 'OCR & image analysis' },
  { to: '/voice', label: 'Voice', icon: Mic, description: 'Speech to text & TTS' },
  { to: '/study-groups', label: 'Study Groups', icon: Users, description: 'Collaborate with peers' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, description: 'Build & showcase work' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, description: 'Schedule & reminders' },
  { to: '/notifications', label: 'Notifications', icon: Bell, description: 'Alerts & updates' },
  { to: '/career', label: 'Career Coach', icon: Briefcase, description: 'Career guidance & interview prep' },
  { to: '/coding', label: 'Coding Playground', icon: Code2, description: 'Practice programming' },
  { to: '/whiteboard', label: 'Whiteboard', icon: Paintbrush, description: 'Collaborative drawing' },
  { to: '/forum', label: 'Community', icon: MessagesSquare, description: 'Q&A and discussions' },
  { to: '/privacy', label: 'Privacy', icon: Lock, description: 'Privacy settings' },
  { to: '/teacher', label: 'Teacher', icon: GraduationCap, description: 'Class management', roles: ['teacher', 'administrator'] as const },
  { to: '/parent', label: 'Parent', icon: Users, description: 'Child progress', roles: ['parent', 'administrator'] as const },
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Preferences' },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, description: 'Platform control', adminOnly: true },
];
