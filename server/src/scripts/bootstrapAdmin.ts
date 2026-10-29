import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import { assertEnvOrReport, env } from '../config/env';
import { User } from '../models/User';
import { logAuditEvent } from '../services/auditService';
import { logger } from '../utils/logger';

async function bootstrapAdmin(): Promise<void> {
  const email = env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.');
  }
  if (env.NODE_ENV !== 'production') {
    throw new Error('The secure super-admin bootstrap is only available when NODE_ENV=production.');
  }

  assertEnvOrReport(logger);
  await connectDB();
  try {
    if (await User.exists({ role: 'platform_super_admin' })) {
      throw new Error('A platform super-admin already exists; refusing to create another bootstrap account.');
    }
    if (await User.exists({ email })) {
      throw new Error('The bootstrap email already belongs to an account; refusing to change its role.');
    }

    const user = await User.create({
      name: 'Platform Super Admin',
      email,
      passwordHash: await bcrypt.hash(password, await bcrypt.genSalt(12)),
      role: 'platform_super_admin',
      isEmailVerified: true,
      isDemoAccount: false,
    });

    await logAuditEvent({
      actorId: user._id as mongoose.Types.ObjectId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'PLATFORM_ADMIN_BOOTSTRAP',
      details: { method: 'environment-gated-one-time-cli' },
    });

    console.log(`Created the initial platform super-admin account for ${email}.`);
  } finally {
    await disconnectDB();
  }
}

bootstrapAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap failure.';
  console.error(`Super-admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});
