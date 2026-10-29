import React, { useState, useRef, useEffect } from 'react';
import {
  Bell, BellRing, Check, CheckCheck, Trash2, X,
  Calendar, FlaskConical, Pill, CreditCard, AlertTriangle,
  MessageSquare, Bed, Users, Loader2
} from 'lucide-react';
import { useSocket, AppNotification } from '../context/SocketContext';

function getNotificationIcon(type: string) {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'appointment_confirmed': return <Calendar className={`${cls} text-indigo-500`} />;
    case 'appointment_cancelled': return <Calendar className={`${cls} text-rose-500`} />;
    case 'appointment_reminder': return <Calendar className={`${cls} text-amber-500`} />;
    case 'lab_result_ready': return <FlaskConical className={`${cls} text-violet-500`} />;
    case 'prescription_issued':
    case 'prescription_dispensed': return <Pill className={`${cls} text-blue-500`} />;
    case 'payment_success': return <CreditCard className={`${cls} text-emerald-500`} />;
    case 'payment_failed': return <CreditCard className={`${cls} text-rose-500`} />;
    case 'bed_assigned': return <Bed className={`${cls} text-indigo-500`} />;
    case 'queue_update': return <Users className={`${cls} text-orange-500`} />;
    case 'message': return <MessageSquare className={`${cls} text-sky-500`} />;
    case 'system_alert': return <AlertTriangle className={`${cls} text-amber-500`} />;
    default: return <Bell className={`${cls} text-slate-400`} />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationItemProps {
  notification: AppNotification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRead, onRemove }) => (
  <div
    className={`group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 ${
      !notification.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
    }`}
    onClick={() => !notification.isRead && onRead(notification._id)}
  >
    <div className="mt-0.5 w-8 h-8 rounded-full bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
      {getNotificationIcon(notification.type)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold leading-tight dark:text-slate-100 ${notification.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
          {notification.title}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!notification.isRead && (
            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(notification._id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-300 hover:text-rose-500 transition-all"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notification.body}</p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{timeAgo(notification.createdAt)}</p>
    </div>
  </div>
);

export const NotificationCenter: React.FC = () => {
  const { connected, notifications, unreadCount, markRead, markAllRead, removeNotification, clearAll } = useSocket();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
        title="Notifications"
        id="notification-bell-btn"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {hasUnread ? (
          <BellRing className="w-5 h-5 animate-[wiggle_1s_ease-in-out_infinite]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}

        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Live dot */}
        {connected && (
          <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white dark:border-slate-800" title="Live" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-[slide-down_0.2s_ease]"
          id="notification-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Notifications</span>
              {connected ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                  LIVE
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Connecting…
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                <Bell className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">You're all caught up!</p>
                <p className="text-xs mt-1">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onRead={(id) => markRead([id])}
                  onRemove={removeNotification}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · Older ones auto-expire after 90 days
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
