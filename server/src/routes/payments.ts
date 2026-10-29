import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middlewares/auth';
import { env } from '../config/env';
import { pushNotification } from '../services/socketService';
import { Appointment } from '../models/Appointment';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { validateBody } from '../middlewares/validate';
import { sendError, ErrorCode, sendNotConfigured } from '../utils/response';
import { logger } from '../utils/logger';

const router = express.Router();
const createOrderSchema = z.object({
  appointmentId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'Invalid appointment ID.'),
}).strict();
const verifyPaymentSchema = z.object({
  appointmentId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), 'Invalid appointment ID.'),
  razorpay_order_id: z.string().min(1).optional(),
  razorpay_payment_id: z.string().min(1).optional(),
  razorpay_signature: z.string().min(1).optional(),
  demo: z.boolean().optional(),
}).strict();

function getRazorpay() {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  // Lazy-load Razorpay to avoid crash when keys are not set
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * POST /api/v1/payments/create-order
 * Creates a Razorpay order for appointment booking payment
 */
router.post('/create-order', requireAuth, requireRole('patient'), validateBody(createOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { appointmentId } = req.body;
    const appointment = await Appointment.findOne({ _id: appointmentId, patientId: userId });
    if (!appointment) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Appointment not found.');
      return;
    }
    if (appointment.status === 'cancelled' || appointment.paymentStatus !== 'pending') {
      sendError(res, 409, ErrorCode.CONFLICT, 'This appointment is not eligible for a new payment.');
      return;
    }
    if (!Number.isFinite(appointment.consultationFee) || appointment.consultationFee <= 0) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'The appointment has no payable consultation fee.');
      return;
    }

    const amount = Math.round(appointment.consultationFee * 100);
    if (!Number.isSafeInteger(amount) || amount > 100_000_000) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'The consultation fee is outside the supported payment range.');
      return;
    }

    const razorpay = getRazorpay();

    if (!razorpay) {
      if (env.NODE_ENV === 'production') {
        sendNotConfigured(res, 'Razorpay payments', 'Configure and verify the payment gateway before accepting payments.');
        return;
      }
      if (!appointment.isDemo) {
        sendNotConfigured(res, 'Razorpay payments', 'A real payment provider is required for non-demo appointments.');
        return;
      }

      const orderId = `demo_order_${crypto.randomUUID()}`;
      appointment.paymentOrderId = orderId;
      await appointment.save();
      return res.json({
        success: true,
        demo: true,
        data: {
          orderId,
          amount,
          currency: 'INR',
          keyId: null,
          appointmentId: appointment._id,
          demo: true,
        },
      });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `appt_${appointment._id}`,
      notes: { appointmentId: appointment._id.toString() },
    });
    appointment.paymentOrderId = order.id;
    await appointment.save();

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID,
        appointmentId: appointment._id,
      },
    });
  } catch (err: any) {
    logger.error('Failed to create a payment order', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Unable to create the payment order right now.');
  }
});

/**
 * POST /api/v1/payments/verify
 * Verify Razorpay payment signature and mark appointment as paid
 */
router.post('/verify', requireAuth, requireRole('patient'), validateBody(verifyPaymentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      appointmentId,
      demo,
    } = req.body;

    const appointment = await Appointment.findOne({ _id: appointmentId, patientId: userId });
    if (!appointment) {
      sendError(res, 404, ErrorCode.NOT_FOUND, 'Appointment not found.');
      return;
    }
    if (appointment.paymentStatus === 'paid') {
      if (appointment.paymentId === razorpay_payment_id) {
        res.json({ success: true, message: 'Payment was already verified.', data: { appointmentId, paymentId: appointment.paymentId } });
      } else {
        sendError(res, 409, ErrorCode.CONFLICT, 'A different payment has already been recorded for this appointment.');
      }
      return;
    }
    if (!appointment.paymentOrderId || appointment.paymentOrderId !== razorpay_order_id) {
      sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Payment order does not match this appointment.');
      return;
    }

    if (demo) {
      if (env.NODE_ENV === 'production' || getRazorpay() || !appointment.isDemo) {
        sendError(res, 503, ErrorCode.INTEGRATION_NOT_CONFIGURED, 'Demo payment verification is disabled for this environment.');
        return;
      }
      if (!razorpay_payment_id?.startsWith('demo_pay_')) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Invalid demo payment reference.');
        return;
      }
    } else {
      const keySecret = env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        sendNotConfigured(res, 'Razorpay payments', 'Configure the payment gateway before verification.');
        return;
      }
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Payment provider verification fields are required.');
        return;
      }

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      const expected = Buffer.from(expectedSignature, 'hex');
      const supplied = Buffer.from(razorpay_signature, 'hex');
      if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        sendError(res, 400, ErrorCode.VALIDATION_FAILED, 'Payment signature verification failed.');
        return;
      }
    }

    appointment.paymentStatus = 'paid';
    appointment.paymentId = razorpay_payment_id;
    appointment.paidAt = new Date();
    await appointment.save();

    // Send success notification
    await pushNotification({
      userId: userId.toString(),
      type: 'payment_success',
      title: demo ? 'Demo Payment Recorded' : 'Payment Successful',
      body: demo
        ? 'A development demo payment was recorded; no real charge was made.'
        : 'Your payment has been confirmed by the payment provider.',
      icon: 'payment',
      data: { appointmentId, paymentId: razorpay_payment_id },
    });

    res.json({
      success: true,
      message: demo ? 'Development demo payment recorded; no real charge was made.' : 'Payment verified successfully.',
      data: { appointmentId, paymentId: razorpay_payment_id },
    });
  } catch (err: any) {
    logger.error('Payment verification failed', { error: err?.message });
    sendError(res, 500, ErrorCode.INTERNAL, 'Unable to verify payment right now.');
  }
});

/**
 * GET /api/v1/payments/config
 * Returns public payment config (Razorpay key, availability)
 */
router.get('/config', requireAuth, async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      provider: 'razorpay',
      configured: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      keyId: env.RAZORPAY_KEY_ID || null,
      currency: 'INR',
      demo: env.NODE_ENV !== 'production' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    },
  });
});

export default router;
