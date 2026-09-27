import { useEffect, useState } from 'react';
import {
  Plus,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  ThumbsUp,
  Eye,
  Send,
} from 'lucide-react';
import { GlassCard, PageHeader, Spinner, EmptyState, Badge } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import type { ForumPostResponse, ForumCommentResponse } from '../lib/types';
import { cn } from '../lib/utils';

const TOPICS = ['General', 'Study Tips', 'Career', 'Projects', 'Programming', 'Languages', 'Exam Prep', 'Research'];

export default function Forum() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<ForumPostResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activePost, setActivePost] = useState<ForumPostResponse | null>(null);
  const [comments, setComments] = useState<ForumCommentResponse[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [form, setForm] = useState({ title: '', content: '', topic: '', tags: '' });

  const loadPosts = async () => {
    try {
      const data = await api.listForumPosts(topicFilter || undefined);
      setPosts(data);
    } catch {
      toast({ title: 'Could not load forum posts', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [topicFilter]);

  const loadComments = async (post: ForumPostResponse) => {
    setActivePost(post);
    setLoadingComments(true);
    setComments([]);
    setCommentContent('');
    try {
      const data = await api.listForumComments(post.id);
      setComments(data);
    } catch {
      toast({ title: 'Could not load comments', variant: 'error' });
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const created = await api.createForumPost({
        title: form.title.trim(),
        content: form.content.trim(),
        topic: form.topic.trim() || null,
        tags,
      });
      setPosts((prev) => [created, ...prev]);
      setForm({ title: '', content: '', topic: '', tags: '' });
      setShowCreate(false);
      toast({ title: 'Post created', variant: 'success' });
    } catch {
      toast({ title: 'Could not create post', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentContent.trim() || !activePost) return;
    setSubmitting(true);
    try {
      const created = await api.createForumComment(activePost.id, { content: commentContent.trim() });
      setComments((prev) => [...prev, created]);
      setCommentContent('');
      toast({ title: 'Comment added', variant: 'success' });
    } catch {
      toast({ title: 'Could not add comment', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPosts = topicFilter ? posts.filter((p) => p.topic === topicFilter) : posts;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Forum"
        subtitle="Ask questions, share insights, and help others."
        actions={
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCreate(true)}
          >
            New Post
          </Button>
        }
      />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Post"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleCreate}>Post</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            placeholder="What's your question?"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextArea
            label="Content"
            placeholder="Describe your question in detail..."
            value={form.content}
            onChange={(val) => setForm((f) => ({ ...f, content: val }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Topic</label>
              <select
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                className="h-11 w-full rounded-xl border border-black/10 bg-white/70 px-3 text-sm outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 dark:bg-white/5 dark:text-chalk"
              >
                <option value="">Select topic</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Input
              label="Tags (comma-separated)"
              placeholder="e.g. math, exam, help"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {activePost ? (
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => { setActivePost(null); setComments([]); }}
          >
            Back to posts
          </Button>

          <GlassCard className="p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {activePost.topic && <Badge tone="brand">{activePost.topic}</Badge>}
              <Badge tone={activePost.is_resolved ? 'sky' : 'amber'}>
                {activePost.is_resolved ? 'Resolved' : 'Unresolved'}
              </Badge>
            </div>
            <h2 className="font-display text-xl font-semibold">{activePost.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{activePost.content}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {activePost.views} views</span>
              <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {activePost.upvotes} upvotes</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {activePost.comment_count} comments</span>
              <span>by {activePost.user_name || 'Unknown'}</span>
              <span>{new Date(activePost.created_at).toLocaleString()}</span>
            </div>
            {activePost.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {activePost.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 sm:p-6">
            <h3 className="mb-4 font-display font-semibold">Comments</h3>
            {loadingComments ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size={20} className="text-brand-400" />
              </div>
            ) : comments.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" />}
                title="No comments yet"
                description="Be the first to comment on this post."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'rounded-xl border p-3 text-sm',
                      c.is_accepted
                        ? 'border-sky-400/30 bg-sky-400/5 dark:bg-sky-400/10'
                        : 'border-black/10 dark:border-white/10',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.user_name || 'User'}</span>
                      {c.is_accepted && (
                        <Badge tone="sky" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Accepted
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-slate-400">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <TextArea
                label="Add a comment"
                placeholder="Share your thoughts..."
                value={commentContent}
                onChange={(val) => setCommentContent(val)}
                rows={2}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  loading={submitting}
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={handleAddComment}
                  disabled={!commentContent.trim()}
                >
                  Comment
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filter by topic:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTopicFilter('')}
                className={cn(
                  'rounded-xl border px-2.5 py-1 text-xs font-medium transition-all',
                  !topicFilter
                    ? 'border-brand-400 bg-brand-400/10 text-brand-700 dark:text-brand-300'
                    : 'glass glass-hover text-slate-600 dark:text-slate-300',
                )}
              >
                All
              </button>
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicFilter(t)}
                  className={cn(
                    'rounded-xl border px-2.5 py-1 text-xs font-medium transition-all',
                    topicFilter === t
                      ? 'border-brand-400 bg-brand-400/10 text-brand-700 dark:text-brand-300'
                      : 'glass glass-hover text-slate-600 dark:text-slate-300',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size={24} className="text-brand-400" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <GlassCard>
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title="No posts found"
                description="Be the first to start a discussion."
                action={
                  <Button
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setShowCreate(true)}
                  >
                    New Post
                  </Button>
                }
              />
            </GlassCard>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPosts.map((post) => (
                <GlassCard
                  key={post.id}
                  hover
                  className="cursor-pointer p-4"
                  onClick={() => loadComments(post)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-semibold">{post.title}</h3>
                        <Badge tone={post.is_resolved ? 'sky' : 'amber'}>
                          {post.is_resolved ? 'Resolved' : 'Unresolved'}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                        {post.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>{post.user_name || 'Unknown'}</span>
                        {post.topic && <Badge tone="brand">{post.topic}</Badge>}
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {post.views}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {post.upvotes}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {post.comment_count}</span>
                        <span>{new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
