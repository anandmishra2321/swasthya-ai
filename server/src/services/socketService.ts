import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Notification } from '../models/Notification';
import mongoose from 'mongoose';

interface AuthSocket extends Socket {
  userId?: string;
  activeWorkspaceId?: string;
}

let io: SocketIOServer | null = null;

/** Maps userId -> Set of socket IDs for that user */
const userSocketMap = new Map<string, Set<string>>();

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [env.FRONTEND_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware: validate JWT on socket connect
  io.use((socket: AuthSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow unauthenticated connections (public notifications room)
      return next();
    }

    try {
      const decoded: any = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id || decoded.sub;
      if (decoded.activeWorkspaceId) socket.activeWorkspaceId = decoded.activeWorkspaceId;
      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const uid = socket.userId;

    if (uid) {
      // Join user's private room
      socket.join(`user:${uid}`);
       if (socket.activeWorkspaceId) {
         socket.join(`org:${socket.activeWorkspaceId}`);
       }


      // Track sockets per user
      if (!userSocketMap.has(uid)) {
        userSocketMap.set(uid, new Set());
      }
      userSocketMap.get(uid)!.add(socket.id);

      // Send unread count on connect
      sendUnreadCount(uid);
    }

    // Client requests its notifications
    socket.on('notifications:fetch', async ({ page = 1, limit = 20 } = {}) => {
      if (!socket.userId) return;
      try {
        const skip = (page - 1) * limit;
        const [notifications, total] = await Promise.all([
          Notification.find({ userId: socket.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Notification.countDocuments({ userId: socket.userId }),
        ]);
        socket.emit('notifications:list', { notifications, total, page, limit });
      } catch (err) {
        socket.emit('notifications:error', { message: 'Failed to fetch notifications' });
      }
    });

    // Client marks notifications as read
    socket.on('notifications:mark_read', async ({ ids }: { ids: string[] }) => {
      if (!socket.userId) return;
      try {
        await Notification.updateMany(
          {
            _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
            userId: socket.userId,
          },
          { isRead: true, readAt: new Date() }
        );
        await sendUnreadCount(socket.userId);
      } catch (err) {
        console.error('[Socket] mark_read error:', err);
      }
    });

    // Client marks ALL as read
    socket.on('notifications:mark_all_read', async () => {
      if (!socket.userId) return;
      try {
        await Notification.updateMany(
          { userId: socket.userId, isRead: false },
          { isRead: true, readAt: new Date() }
        );
        await sendUnreadCount(socket.userId);
      } catch (err) {
        console.error('[Socket] mark_all_read error:', err);
      }
    });

    socket.on('disconnect', () => {
      if (uid) {
        userSocketMap.get(uid)?.delete(socket.id);
        if (userSocketMap.get(uid)?.size === 0) {
          userSocketMap.delete(uid);
        }
      }
    });
  });

  console.log('[Socket.IO] Real-time notification server initialized.');
  return io;
}

async function sendUnreadCount(userId: string): Promise<void> {
  if (!io) return;
  try {
    const count = await Notification.countDocuments({ userId, isRead: false });
    io.to(`user:${userId}`).emit('notifications:unread_count', { count });
  } catch (err) {
    console.error('[Socket] sendUnreadCount error:', err);
  }
}

/**
 * Push a real-time notification to a user.
 * Also persists it in MongoDB so the user sees it when they reconnect.
 */
export async function pushNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { userId, type, title, body, icon, data } = params;

  try {
    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      type,
      title,
      body,
      icon,
      data,
      isRead: false,
    });

    if (io) {
      io.to(`user:${userId}`).emit('notifications:new', {
        notification: notification.toObject(),
      });
      await sendUnreadCount(userId);
    }
  } catch (err) {
    console.error('[Socket] pushNotification error:', err);
  }
}

export function emitToUser(userId: string, event: string, payload: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToOrg(organizationId: string, event: string, payload: any): void {
  if (!io) return;
  io.to(`org:${organizationId}`).emit(event, payload);
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
