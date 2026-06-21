import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  bench_id: string;
  actor_id: string | null;
  type: 'rating' | 'photo' | 'confirmation' | 'visit';
  read: boolean;
  created_at: string;
  bench_name?: string;
  actor_username?: string;
}

const TYPE_LABELS: Record<Notification['type'], string> = {
  rating: 'rated your bench',
  photo: 'added a photo to your bench',
  confirmation: 'confirmed your bench',
  visit: 'visited your bench',
};

const TYPE_ICONS: Record<Notification['type'], string> = {
  rating: '⭐',
  photo: '📸',
  confirmation: '✅',
  visit: '👣',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchNotifications();

    // Realtime subscription for new notifications
    const channel = supabase
      .channel('bench_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bench_notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function fetchNotifications() {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('bench_notifications')
      .select('id, bench_id, actor_id, type, read, created_at, benches(name), profiles!bench_notifications_actor_id_fkey(username)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data) return;

    setNotifications(data.map((row: any) => ({
      id: row.id,
      bench_id: row.bench_id,
      actor_id: row.actor_id,
      type: row.type,
      read: row.read,
      created_at: row.created_at,
      bench_name: row.benches?.name ?? 'a bench',
      actor_username: row.profiles?.username ?? 'Someone',
    })));
  }

  async function markAllRead() {
    if (!session?.user?.id || unreadCount === 0) return;
    await supabase
      .from('bench_notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function handleNotificationClick(n: Notification) {
    // Mark as read
    if (!n.read) {
      await supabase.from('bench_notifications').update({ read: true }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    setOpen(false);
    navigate(`/bench/${n.bench_id}`);
  }

  if (!session?.user?.id) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition border btn-press ${
          open
            ? 'bg-gray-900 border-gray-900 text-white'
            : 'bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Your bench activity</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                <div className="text-3xl mb-2">🪑</div>
                No activity yet. When someone rates, photos, or visits one of your benches, you'll see it here.
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 ${
                    !n.read ? 'bg-green-50' : ''
                  }`}
                >
                  <span className="text-lg mt-0.5 flex-shrink-0">{TYPE_ICONS[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">
                      <span className="font-semibold">{n.actor_username}</span>{' '}
                      {TYPE_LABELS[n.type]}{' '}
                      <span className="font-medium text-green-700 truncate">"{n.bench_name}"</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
