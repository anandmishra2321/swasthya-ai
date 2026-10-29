import { Membership } from '../models/Membership';
import { Organization } from '../models/Organization';
import mongoose from 'mongoose';

export interface WorkspaceSummary {
  membershipId: string | null;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  role: string;
  /** 'owner' when the user owns the organization rather than holding a membership. */
  via: 'membership' | 'ownership';
}

/**
 * Lists every workspace a user may legitimately switch into.
 *
 * A workspace is an approved affiliation: an active Membership row, or an
 * organization the user owns. Nothing else grants access — being a doctor does
 * not implicitly grant access to every hospital.
 */
export async function listWorkspacesForUser(userId: mongoose.Types.ObjectId | string): Promise<WorkspaceSummary[]> {
  const [memberships, ownedOrgs] = await Promise.all([
    Membership.find({ userId, status: 'active' }).populate('organizationId'),
    Organization.find({ ownerId: userId }),
  ]);

  const viaMembership: WorkspaceSummary[] = memberships
    .filter((m: any) => m.organizationId)
    .map((m: any) => ({
      membershipId: m._id?.toString() ?? null,
      organizationId: m.organizationId._id.toString(),
      organizationName: m.organizationId.name,
      organizationType: m.organizationId.type,
      role: m.role,
      via: 'membership' as const,
    }));

  const ownedIds = new Set(viaMembership.map((w) => w.organizationId));

  const viaOwnership: WorkspaceSummary[] = ownedOrgs
    .filter((o: any) => !ownedIds.has(o._id.toString()))
    .map((o: any) => ({
      membershipId: null,
      organizationId: o._id.toString(),
      organizationName: o.name,
      organizationType: o.type,
      role: 'owner',
      via: 'ownership' as const,
    }));

  return [...viaMembership, ...viaOwnership];
}

/**
 * Confirms the user may act inside the organization. Owners and platform super
 * admins are allowed; everyone else needs an active membership.
 */
export async function resolveWorkspaceAccess(
  userId: mongoose.Types.ObjectId | string,
  organizationId: string,
  userRole: string
): Promise<{ allowed: boolean; role: string | null; organization: any | null }> {
  const org = await Organization.findById(organizationId);
  if (!org) return { allowed: false, role: null, organization: null };

  if (org.ownerId && org.ownerId.toString() === userId.toString()) {
    return { allowed: true, role: 'owner', organization: org };
  }

  if (userRole === 'platform_super_admin') {
    return { allowed: true, role: 'platform_super_admin', organization: org };
  }

  const membership = await Membership.findOne({ userId, organizationId, status: 'active' });
  if (membership) {
    return { allowed: true, role: membership.role, organization: org };
  }

  return { allowed: false, role: null, organization: org };
}
