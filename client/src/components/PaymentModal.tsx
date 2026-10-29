import React, { useState, useEffect } from 'react';
import { CreditCard, X, CheckCircle, AlertCircle, Loader2, IndianRupee, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentData: { paymentId: string; appointmentId?: string }) => void;
  amount: number;
  description: string;
  appointmentId?: string;
  patientName?: string;
  doctorName?: string;
}

type PaymentStep = 'confirm' | 'processing' | 'success' | 'failed';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
  description,
  appointmentId,
  patientName,
  doctorName,
}) => {
  const [step, setStep] = useState<PaymentStep>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [demoPayment, setDemoPayment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setError(null);
      setDemoPayment(false);
    }
  }, [isOpen]);

  const handlePay = async () => {
    setStep('processing');
    setError(null);

    try {
      if (!appointmentId) {
        throw new Error('An appointment is required before payment can be created.');
      }

      // The server derives the price from the persisted appointment.
      const orderRes: any = await api.post('/payments/create-order', {
        appointmentId,
      });

      if (!orderRes.success) {
        throw new Error('Failed to create payment order');
      }

      const { orderId, keyId, demo, amount: serverAmount } = orderRes.data;
      setDemoPayment(Boolean(demo));
      if (serverAmount !== Math.round(amount * 100)) {
        throw new Error('The appointment fee changed. Close this dialog and review the current fee.');
      }

      if (demo || !keyId || keyId === 'demo_key') {
        const demoPaymentId = `demo_pay_${Date.now()}`;

        const verifyRes: any = await api.post('/payments/verify', {
          razorpay_order_id: orderId,
          razorpay_payment_id: demoPaymentId,
          razorpay_signature: 'demo_sig',
          appointmentId,
          demo: true,
        });

        if (verifyRes.success) {
          setStep('success');
          setTimeout(() => {
            onSuccess({ paymentId: demoPaymentId, appointmentId });
          }, 1500);
        } else {
          throw new Error('Demo payment verification failed');
        }
        return;
      }

      // 2. Real Razorpay flow — load Razorpay SDK if not already loaded
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.head.appendChild(script);
        });
      }

      const razorpayOptions = {
        key: keyId,
        amount: orderRes.data.amount,
        currency: orderRes.data.currency || 'INR',
        order_id: orderId,
        name: 'Swasthya AI',
        description,
        image: '/favicon.ico',
        prefill: { name: patientName || '' },
        theme: { color: '#0d9488' },
        handler: async (response: any) => {
          try {
            const verifyRes: any = await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              appointmentId,
            });

            if (verifyRes.success) {
              setStep('success');
              setTimeout(() => {
                onSuccess({ paymentId: response.razorpay_payment_id, appointmentId });
              }, 1500);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (err: any) {
            setStep('failed');
            setError(err.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            setStep('confirm');
          },
        },
      };

      new (window as any).Razorpay(razorpayOptions).open();
    } catch (err: any) {
      setStep('failed');
      setError(err.message || 'Payment failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fade-in_0.15s_ease]">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Secure Payment</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {import.meta.env.DEV ? 'Provider verification required' : 'Powered by Razorpay'}
              </p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-6">
          {step === 'confirm' && (
            <div className="space-y-5">
              {/* Amount display */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-4xl font-black text-slate-900 dark:text-slate-100">
                  <IndianRupee className="w-8 h-8" />
                  <span>{amount.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
              </div>

              {/* Details */}
              {(patientName || doctorName) && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4 space-y-2">
                  {patientName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Patient</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientName}</span>
                    </div>
                  )}
                  {doctorName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Doctor</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{doctorName}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-600 pt-2 mt-2">
                    <span className="text-slate-500 dark:text-slate-400">Total</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>The server marks payment paid only after verification.</span>
              </div>
              {import.meta.env.DEV && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                  If the local demo payment option is shown, it is a simulation and does not charge a payment method.
                </p>
              )}

              <button
                onClick={handlePay}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0"
                id="pay-now-btn"
              >
                Pay ₹{amount.toLocaleString('en-IN')}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">Processing Payment…</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please do not close this window.</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 animate-[scale-in_0.3s_ease]" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {demoPayment ? 'Demo Payment Recorded' : 'Payment Successful!'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {demoPayment
                    ? 'Development demo payment recorded; no real charge was made.'
                    : 'Payment was confirmed by the provider.'}
                </p>
              </div>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">Payment Failed</p>
                <p className="text-sm text-rose-500 mt-1">{error || 'Something went wrong.'}</p>
              </div>
              <button
                onClick={() => setStep('confirm')}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
