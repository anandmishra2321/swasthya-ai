// nodemailer is an optional dependency used only for SMTP delivery in production.
// It is not installed by default (and not needed for the mock/dev flow), so we
// load it lazily to keep `tsc` and dev startup working without it.
let nodemailer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}
import { env } from '../config/env';
import { sendError, sendOk, ErrorCode } from '../utils/response';

/**
 * Email service configuration and sending.
 * 
 * In development/mock mode, generates demo links without sending actual emails.
 * In production, requires an email delivery adapter (SendGrid, SMTP, etc.).
 * 
 * Configuration via env vars:
 * - EMAIL_PROVIDER: 'smtp' | 'sendgrid' | 'mock' (default: 'mock')
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: SMTP credentials
 * - EMAIL_FROM: sender address
 */

export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    template?: string;
    context?: Record<string, any>;
}

/**
 * Send an email using the configured provider.
 * Returns true if sent successfully, false if not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    const provider = env.EMAIL_PROVIDER;

    // Mock mode: generate demo links without sending emails
    if (provider === 'mock' || env.NODE_ENV !== 'production') {
        console.log('[Email] Mock mode: Email not sent (demo mode)', { to: options.to, subject: options.subject });
        return true;
    }

    // Production without configuration
    if (!env.SMTP_HOST || env.EMAIL_PROVIDER === 'none') {
        console.log('[Email] Not configured: Email delivery unavailable', { provider });
        return false;
    }

    try {
        // SMTP transport
        if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
            if (!nodemailer) {
              console.log('[Email] nodemailer not installed; SMTP delivery unavailable');
              return false;
            }
            const transporter = nodemailer.createTransport({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT || 587,
                secure: env.SMTP_PORT === 465, // true for 465, false for other ports
                auth: {
                    user: env.SMTP_USER,
                    pass: env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: env.EMAIL_FROM || 'notifications@swasthya-demo.local',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            };

            await transporter.sendMail(mailOptions);
            console.log('[Email] Sent via SMTP', { to: options.to, subject: options.subject });
            return true;
        }

        // SendGrid transport
        if (env.EMAIL_PROVIDER === 'sendgrid' && env.SMTP_USER) {
            // SendGrid integration would go here
            // For now, fall back to SMTP or log
            console.log('[Email] SendGrid not fully implemented, using fallback');
            return false;
        }

        console.log('[Email] Unknown provider:', provider);
        return false;
    } catch (err) {
        console.error('[Email] Send failed', { error: (err as Error).message, to: options.to });
        return false;
    }
}

/**
 * Send password reset email with demo link.
 * In production without email configured, returns a demo link for local testing.
 */
export async function sendPasswordResetEmail(
    email: string,
    resetToken: string,
    baseUrl: string = 'http://localhost:5000'
): Promise<boolean> {
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    const options: EmailOptions = {
        to: email,
        subject: 'Password Reset - Swasthya AI',
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Swasthya AI account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #2d3748; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </div>
        <p>If you didn't request this, please ignore this email or contact support.</p>
        <p>This link will expire in 1 hour.</p>
        <hr />
        <p style="font-size: 12px; color: #7f8c8d;">
          Swasthya AI Healthcare Platform<br />
          {env.NODE_ENV === 'production' ? 'Contact your administrator' : 'Local demo environment'}
        </p>
      </div>
    `,
    };

    const sent = await sendEmail(options);
    if (!sent && env.NODE_ENV !== 'production') {
        // In demo mode, also return the link in the response metadata
        // The caller can include this in the API response
        console.log('[Email] Demo mode: returning reset link', { resetLink });
    }

    return sent;
}

/**
 * Send email verification email with demo link.
 */
export async function sendVerificationEmail(
    email: string,
    verificationToken: string,
    baseUrl: string = 'http://localhost:5000'
): Promise<boolean> {
    const verifyLink = `${baseUrl}/verify-email?token=${verificationToken}`;

    const options: EmailOptions = {
        to: email,
        subject: 'Email Verification - Swasthya AI',
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Thank you for registering with Swasthya AI!</p>
        <p>Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background: #2d3748; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        </div>
        <p>If you didn't register, please ignore this email.</p>
        <hr />
        <p style="font-size: 12px; color: #7f8c8d;">
          Swasthya AI Healthcare Platform
        </p>
      </div>
    `,
    };

    return await sendEmail(options);
}

/**
 * Send organization invitation email.
 */
export async function sendInvitationEmail(
    email: string,
    invitationToken: string,
    organizationName: string,
    role: string,
    baseUrl: string = 'http://localhost:5000'
): Promise<boolean> {
    const acceptLink = `${baseUrl}/accept-invitation?token=${invitationToken}`;

    const options: EmailOptions = {
        to: email,
        subject: `Invitation to join ${organizationName} - Swasthya AI`,
        html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're Invited</h2>
        <p>You have been invited to join the ${organizationName} organization on Swasthya AI.</p>
        <p>Your role: ${role}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptLink}" style="background: #2d3748; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
        </div>
        <p>This invitation will expire in 7 days.</p>
        <hr />
        <p style="font-size: 12px; color: #7f8c8d;">
          Swasthya AI Healthcare Platform
        </p>
      </div>
    `,
    };

    return await sendEmail(options);
}

export default { sendEmail, sendPasswordResetEmail, sendVerificationEmail, sendInvitationEmail };