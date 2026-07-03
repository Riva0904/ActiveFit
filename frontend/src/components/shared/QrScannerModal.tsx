'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';

interface Props {
  expectedVpa: string;
  onMatch: () => void;
  onClose: () => void;
}

export function QrScannerModal({ expectedVpa, onMatch, onClose }: Props) {
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const scannerRef = useRef<any>(null);
  const onMatchRef = useRef(onMatch);
  onMatchRef.current = onMatch;

  useEffect(() => {
    let active = true;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!active) return;

      const scanner = new Html5Qrcode('ab-qr-reader');
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded: string) => {
            // UPI deep-link format: upi://pay?pa=vpa@handle&pn=Name&am=...
            const m = decoded.match(/[?&]pa=([^&]+)/i);
            const scannedVpa = m ? decodeURIComponent(m[1]).trim() : '';

            if (scannedVpa.toLowerCase() === expectedVpa.toLowerCase()) {
              scanner.stop().catch(() => {}).finally(() => onMatchRef.current());
            } else {
              scanner.stop().catch(() => {});
              if (active) {
                setError(
                  scannedVpa
                    ? `Wrong UPI ID. Expected ${expectedVpa}, got ${scannedVpa}.`
                    : "Not a UPI QR code. Try the gym's UPI sticker/poster."
                );
                setStatus('error');
              }
            }
          },
          () => {} // per-frame decode failures — normal, ignore
        )
        .then(() => { if (active) setStatus('scanning'); })
        .catch(() => {
          if (active) {
            setError('Camera access denied. Allow camera permission in browser settings and retry.');
            setStatus('error');
          }
        });
    });

    return () => {
      active = false;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [expectedVpa, retryKey]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="gradient-brand px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold">
            <Camera className="w-4 h-4" /> Scan Gym UPI QR
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {status === 'starting' && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Starting camera…
            </div>
          )}

          {status === 'scanning' && (
            <p className="text-xs text-muted-foreground text-center">
              Point camera at the gym's UPI QR code poster or sticker
            </p>
          )}

          {/* html5-qrcode mounts camera feed + scan-box overlay into this div */}
          <div
            id="ab-qr-reader"
            className="rounded-xl overflow-hidden bg-black"
            style={{ minHeight: status === 'error' ? 0 : 260 }}
          />

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-xl text-sm text-rose-700 dark:text-rose-400">
              <p className="font-semibold mb-1">Scan failed</p>
              <p>{error}</p>
              <button
                onClick={() => { setError(null); setStatus('starting'); setRetryKey(k => k + 1); }}
                className="mt-2 text-xs font-bold underline"
              >
                Try again
              </button>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Must match gym's registered UPI: <span className="font-semibold">{expectedVpa}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default QrScannerModal;
