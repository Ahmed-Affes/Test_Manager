'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Check,
  Trash2,
  ArrowLeft,
  ExternalLink,
  Clock,
  Filter,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  const [processing, setProcessing] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirectTo=/notifications');
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch notifications error:', error);
      } else {
        setNotifications((data as Notification[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setProcessing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleClearRead = async () => {
    setProcessing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Projects</span>
          </Link>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-500">
              <Bell className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500 text-white">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleMarkAllRead}
              disabled={processing}
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 gap-1.5"
            >
              <Check className="h-3 w-3" />
              Mark All Read
            </Button>
          )}

          {notifications.some((n) => n.is_read) && (
            <Button
              size="xs"
              variant="ghost"
              onClick={handleClearRead}
              disabled={processing}
              className="text-zinc-400 hover:text-rose-400 gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Clear Read
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Filter Tabs */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'unread'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === 'read'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>

          <span className="text-xs text-zinc-500 font-mono">
            {filteredNotifications.length} items
          </span>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-zinc-900/40 border border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 text-center border border-dashed rounded-xl border-zinc-800 bg-zinc-900/20 space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-300">You&apos;re all caught up!</p>
              <p className="text-xs text-zinc-500 mt-1">
                {filter === 'unread'
                  ? 'No unread notifications at the moment.'
                  : 'No notifications found matching this filter.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                  !n.is_read
                    ? 'bg-zinc-900/70 border-zinc-700/80 shadow-sm hover:border-zinc-600'
                    : 'bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 shrink-0">
                  {getIcon(n.type)}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-xs font-semibold truncate ${
                        !n.is_read ? 'text-zinc-100' : 'text-zinc-300'
                      }`}
                    >
                      {n.title}
                    </h3>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(n.created_at)}
                    </span>
                    {n.link && (
                      <span className="flex items-center gap-1 text-blue-400 hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        View target
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.is_read && (
                    <Button
                      size="iconSm"
                      variant="ghost"
                      title="Mark as read"
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="text-zinc-400 hover:text-zinc-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="iconSm"
                    variant="ghost"
                    title="Delete notification"
                    onClick={(e) => handleDeleteNotification(n.id, e)}
                    className="text-zinc-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
