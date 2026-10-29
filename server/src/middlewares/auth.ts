import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser, UserRole } from '../models/User';
import { Membership } from '../models/Membership';
import { sendError, ErrorCode } from '../utils/response';
import mongoose from 'mongoose';

export interface AuthRequest extends Request {
  user?: IUser;
  activeWorkspaceId?: mongoose.Types.ObjectId;
  workspaceRole?: string;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  activeWorkspaceId?: string;
}

export function generateTokens(user: IUser, activeWorkspaceId?: string) {
  const payload: JwtPayload = {
    userId: (user._id as mongoose.Types.ObjectId).toString(),
    role: user.role,
    activeWorkspaceId: activeWorkspaceId || (user.activeWorkspaceId ? user.activeWorkspaceId.toString() : undefined),
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '2h',
  });

  const refreshToken = jwt.sign(
    { userId: (user._id as mongoose.Types.ObjectId).toString() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  return authenticate(req, res, next);
};

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Authentication required. Please sign in to access this resource.');
    return;
  }

  const token = authHeader.split(' ')[1];

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Session expired or invalid token. Please sign in again.');
    return;
  }

  try {
    const user = await User.findById(decoded.userId);

    if (!user) {
      sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'User not found or account has been deactivated.');
      return;
    }

    req.user = user;

    // Check header for explicit workspace switch or use user's active workspace
    const workspaceHeader = req.headers['x-workspace-id'] as string;
    const targetWorkspaceId = workspaceHeader || (decoded.activeWorkspaceId ? decoded.activeWorkspaceId : undefined);

    if (targetWorkspaceId && mongoose.Types.ObjectId.isValid(targetWorkspaceId)) {
      req.activeWorkspaceId = new mongoose.Types.ObjectId(targetWorkspaceId);

      // Verify membership in workspace
      const membership = await Membership.findOne({
        userId: user._id,
        organizationId: req.activeWorkspaceId,
        status: 'active',
      });

      if (membership) {
        req.workspaceRole = membership.role;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
