import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Membership } from '../models/Membership';
import { Organization } from '../models/Organization';
import { sendError, ErrorCode } from '../utils/response';
import mongoose from 'mongoose';

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Authentication required.');
      return;
    }

    // Platform Super Admin has access to all admin-level routes
    if (req.user.role === 'platform_super_admin') {
      next();
      return;
    }

    const effectiveRole = req.workspaceRole || req.user.role;

    if (!allowedRoles.includes(effectiveRole) && !allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        403,
        ErrorCode.FORBIDDEN,
        `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${effectiveRole}`,
        { requiredRoles: allowedRoles, yourRole: effectiveRole }
      );
      return;
    }

    next();
  };
}

export function requireOrganizationAccess(orgIdParam: string = 'organizationId') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 401, ErrorCode.UNAUTHENTICATED, 'Authentication required.');
      return;
    }

    if (req.user.role === 'platform_super_admin') {
      next();
      return;
    }

    const orgId = req.params[orgIdParam] || req.body[orgIdParam] || req.query[orgIdParam] || req.activeWorkspaceId?.toString();

    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Valid Organization ID is required.');
      return;
    }

    // Check if user is the direct owner of the organization
    const org = await Organization.findById(orgId);
    if (!org) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Organization not found.');
      return;
    }

    if (!org.isVerified) {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'Organization access is unavailable until verification is complete.');
      return;
    }

    if (org.ownerId && org.ownerId.toString() === (req.user._id as mongoose.Types.ObjectId).toString()) {
      next();
      return;
    }

    // Check active membership
    const membership = await Membership.findOne({
      userId: req.user._id,
      organizationId: org._id,
      status: 'active',
    });

    if (!membership) {
      sendError(res, 403, ErrorCode.FORBIDDEN, 'Access denied: You are not an active member of this organization.');
      return;
    }

    req.workspaceRole = membership.role;
    req.activeWorkspaceId = org._id as mongoose.Types.ObjectId;
    next();
  };
}
