import { useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Sparkles, X, Trash2, Plus } from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { api } from '../../lib/api';
import { useAppDispatch, useAppSelector } from '../../store';
import { setConversations, removeConversation, addConversation } from '../../store/chatSlice';
import { setSidebar } from '../../store/uiSlice';
import { cn } from '../../lib/utils';
import type { Conversation } from '../../lib/types';

export function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const conversations = useAppSelector((s) => s.chat.conversations);
  
  const navItems = NAV_ITEMS.filter((i) => 
    ['/dashboard', '/classroom', '/translate', '/coding', '/settings'].includes(i.to)
  );

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.listConversations();
      dispatch(setConversations(list));
    } catch (err) {
      console.error('Failed to load chats', err);
    }
  }, [dispatch]);

  useEffect(() => {
    if (conversations.length === 0) {
        loadConversations();
    }
  }, [conversations.length, loadConversations]);

  const deleteConversation = async (conversation: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let hasMessages = false;
    try {
        const msgs = await api.listMessages(conversation.id);
        hasMessages = msgs && msgs.length > 0;
    } catch (err) {
        console.error('Error checking messages', err);
    }

    if (hasMessages) {
        if (!confirm(`Are you sure you want to delete the conversation "${conversation.title}"? This action cannot be undone.`)) {
            return;
        }
    }

    await api.deleteConversation(conversation.id);
    dispatch(removeConversation(conversation.id));
  };

  const createNewChat = async () => {
    const c = await api.createConversation('New chat');
    dispatch(addConversation(c));
    navigate(`/chat?conversation=${c.id}`);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(setSidebar(false))}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col p-4 transition-transform duration-300 ease-out lg:static lg:translate-x-0',
          'bg-slate-50 border-r border-slate-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-2 py-3 mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-lg"
          >
            <Sparkles size={20} className="text-brand-500" />
            <span className="text-lg font-bold">SMARTER AI</span>
          </button>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 lg:hidden"
            onClick={() => dispatch(setSidebar(false))}
          >
            <X size={20} />
          </button>
        </div>

        <button
            onClick={createNewChat}
            className="flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 mb-4"
        >
            <Plus size={18} />
            <span>New Chat</span>
        </button>

        <nav className="space-y-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1 flex flex-col mt-6 overflow-hidden">
            <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase mb-2">Recent Chats</h3>
            <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.map((c) => (
                    <NavLink
                        key={c.id}
                        to={`/chat?conversation=${c.id}`}
                        className={({ isActive }) =>
                            cn(
                                'group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                                isActive ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                            )
                        }
                    >
                        <span className="truncate">{c.title}</span>
                        <Trash2 size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={(e) => deleteConversation(c, e)} />
                    </NavLink>
                ))}
            </div>
        </div>
      </aside>
    </>
  );
}
