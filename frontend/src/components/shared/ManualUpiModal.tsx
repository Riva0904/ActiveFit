'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { paymentsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { QrScannerModal } from './QrScannerModal';

interface ManualUpiModalProps {
  paymentId: string;
  amount: number;
  vpa: string;
  payeeName: string;
  description: string;
  onClose: () => void;
  onMarkedPaid: () => void;
}

// Plain UPI deep-link/QR — no gateway involved. Money goes straight to the gym's
// own VPA. The gym admin confirms receipt by hand after checking their bank app;
// that confirm click is what actually activates the plan (see PendingUpiPayments).
export function ManualUpiModal({ paymentId, amount, vpa, payeeName, description, onClose, onMarkedPaid }: ManualUpiModalProps) {
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const upiUri = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}`;

  const handleMarkPaid = async () => {
    setMarking(true);
    try {
      await paymentsApi.markPaid(paymentId);
      setMarked(true);
      toast.success('Marked as paid — waiting for gym to confirm');
      onMarkedPaid();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to mark as paid');
    }
    setMarking(false);
  };

  return (
    <>
    {showScanner && (
      <QrScannerModal
        expectedVpa={vpa}
        onMatch={() => {
          setShowScanner(false);
          // VPA validated — open UPI deep link with amount pre-filled
          window.location.href = upiUri;
        }}
        onClose={() => setShowScanner(false)}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-pop">
        <div className="gradient-brand p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <h2 className="font-extrabold text-xl text-white">Pay via UPI</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white/70 relative">{description}</p>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          {!marked ? (
            <>
              <div className="bg-white p-3 rounded-2xl">
                <QRCodeSVG value={upiUri} size={180} level="M" />
              </div>
              <p className="text-2xl font-extrabold">{formatCurrency(amount)}</p>
              <p className="text-sm text-muted-foreground text-center">
                Scan with any UPI app (GPay, PhonePe, Paytm) to pay <span className="font-semibold">{payeeName}</span>
              </p>
              <a
                href={upiUri}
                className="w-full text-center py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-bold"
              >
                Open in UPI app
              </a>
              <button
                onClick={() => setShowScanner(true)}
                className="w-full py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-bold flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Scan Gym QR instead
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={marking}
                className="w-full py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {marking ? 'Submitting…' : "I've Paid"}
              </button>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-bold">Submitted for verification</p>
              <p className="text-sm text-muted-foreground">
                The gym will confirm once they see the payment in their account. Your plan activates the moment they confirm.
              </p>
              <button onClick={onClose} className="mt-2 px-5 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default ManualUpiModal;
