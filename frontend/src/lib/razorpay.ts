import { paymentsApi } from './api';

interface OpenRazorpayOptions {
  orderId: string;
  paymentId: string;
  amount: number;
  description: string;
  theme?: string;
  onSuccess: () => void | Promise<void>;
}

export async function openRazorpay({
  orderId,
  paymentId,
  amount,
  description,
  theme = '#f97316',
  onSuccess,
}: OpenRazorpayOptions): Promise<void> {
  if (typeof window === 'undefined' || !(window as any).Razorpay) {
    throw new Error('Razorpay not loaded. Please refresh.');
  }
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: amount * 100,
      currency: 'INR',
      name: 'ActiveBoost',
      description,
      order_id: orderId,
      handler: async (response: any) => {
        try {
          await paymentsApi.verify({
            paymentId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
          await onSuccess();
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      theme: { color: theme },
    });
    rzp.open();
  });
}
