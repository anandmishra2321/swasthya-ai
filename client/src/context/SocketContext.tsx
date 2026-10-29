import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TOKEN_KEY } from '../services/api';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface SocketContextType {
  connected: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  fetchMore: (page: number) => void;
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  removeNotification: () => {},
  clearAll: () => {},
  fetchMore: () => {},
});

const SOCKET_URL = 'http://localhost:5000';
const MAX_NOTIFICATIONS = 100;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const initSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem(TOKEN_KEY);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Load initial notifications on connect
      socket.emit('notifications:fetch', { page: 1, limit: 30 });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('notifications:list', ({ notifications: list }: { notifications: AppNotification[] }) => {
      setNotifications(list.slice(0, MAX_NOTIFICATIONS));
    });

    socket.on('notifications:new', ({ notification }: { notification: AppNotification }) => {
      setNotifications((prev) => [notification, ...prev].slice(0, MAX_NOTIFICATIONS));
    });

    socket.on('notifications:unread_count', ({ count }: { count: number }) => {
      setUnreadCount(count);
    });


    socket.on('beds:updated', (payload: any) => {
      window.dispatchEvent(new CustomEvent('swasthya:beds-updated', { detail: payload }));
    });
    socket.on('appointment:updated', (payload: any) => {
      window.dispatchEvent(new CustomEvent('swasthya:appointment-updated', { detail: payload }));
    });
    socket.on('lab:result:released', (payload: any) => {
      window.dispatchEvent(new CustomEvent('swasthya:lab-result-released', { detail: payload }));
    });
    socketRef.current = socket;
  }, []);

  const destroySocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Re-init socket when token changes (login/logout)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        if (e.newValue) {
          destroySocket();
          setTimeout(initSocket, 200);
        } else {
          destroySocket();
        }
      }
    };

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) initSocket();

    window.addEventListener('storage', handleStorageChange);

    // Also handle same-tab login (CustomEvent)
    const handleLogin = () => {
      destroySocket();
      setTimeout(initSocket, 300);
    };
    window.addEventListener('swasthya:login', handleLogin);
    window.addEventListener('swasthya:session-expired', destroySocket);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('swasthya:login', handleLogin);
      window.removeEventListener('swasthya:session-expired', destroySocket);
      destroySocket();
    };
  }, [initSocket, destroySocket]);

  const markRead = useCallback((ids: string[]) => {
    socketRef.current?.emit('notifications:mark_read', { ids });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n._id) ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - ids.filter((id) => {
      const n = notifications.find((n) => n._id === id);
      return n && !n.isRead;
    }).length));
  }, [notifications]);

  const markAllRead = useCallback(() => {
    socketRef.current?.emit('notifications:mark_all_read');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const fetchMore = useCallback((page: number) => {
    socketRef.current?.emit('notifications:fetch', { page, limit: 20 });
  }, []);

  return (
    <SocketContext.Provider value={{
      connected,
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      removeNotification,
      clearAll,
      fetchMore,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
