'use client';

import { useRef, useState, useCallback } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type PhoneAuthStep = 'phone' | 'otp';

export interface UseFirebasePhoneAuthReturn {
  step: PhoneAuthStep;
  loading: boolean;
  error: string | null;
  countdown: number;
  setError: (msg: string | null) => void;
  setStep: (s: PhoneAuthStep) => void;
  initRecaptcha: (containerId: string) => void;
  sendOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<{ idToken: string; phone: string }>;
  resendOtp: (phoneNumber: string, containerId: string) => Promise<boolean>;
  reset: () => void;
}

export function useFirebasePhoneAuth(): UseFirebasePhoneAuthReturn {
  const [step, setStep]         = useState<PhoneAuthStep>('phone');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef    = useRef<RecaptchaVerifier | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((seconds = 30) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const clearRecaptcha = useCallback(() => {
    try { recaptchaRef.current?.clear(); } catch { /* already cleared */ }
    recaptchaRef.current = null;
  }, []);

  const initRecaptcha = useCallback((containerId: string) => {
    clearRecaptcha();
    recaptchaRef.current = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': clearRecaptcha,
    });
  }, [clearRecaptcha]);

  const sendOtp = useCallback(async (phoneNumber: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (!recaptchaRef.current) throw new Error('reCAPTCHA not initialised');
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaRef.current);
      confirmationRef.current = result;
      setStep('otp');
      startCountdown(30);
      return true;
    } catch (err: any) {
      setError(mapFirebaseError(err.code ?? err.message));
      clearRecaptcha();
      return false;
    } finally {
      setLoading(false);
    }
  }, [startCountdown, clearRecaptcha]);

  const verifyOtp = useCallback(async (otp: string) => {
    if (!confirmationRef.current) throw new Error('Session expired — request a new OTP.');
    setLoading(true);
    setError(null);
    try {
      const result  = await confirmationRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();
      const phone   = result.user.phoneNumber ?? '';
      return { idToken, phone };
    } catch (err: any) {
      const msg = mapFirebaseError(err.code ?? err.message);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const resendOtp = useCallback(async (phoneNumber: string, containerId: string): Promise<boolean> => {
    initRecaptcha(containerId);
    return sendOtp(phoneNumber);
  }, [initRecaptcha, sendOtp]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    clearRecaptcha();
    confirmationRef.current = null;
    setStep('phone');
    setLoading(false);
    setError(null);
    setCountdown(0);
  }, [clearRecaptcha]);

  return { step, loading, error, countdown, setError, setStep, initRecaptcha, sendOtp, verifyOtp, resendOtp, reset };
}

function mapFirebaseError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-phone-number':      'Invalid phone number. Use international format (e.g. +91XXXXXXXXXX).',
    'auth/missing-phone-number':      'Please enter your phone number.',
    'auth/quota-exceeded':            'SMS quota exceeded. Try again later.',
    'auth/user-disabled':             'This account has been disabled.',
    'auth/operation-not-allowed':     'Phone sign-in is not enabled. Contact administrator.',
    'auth/too-many-requests':         'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-verification-code': 'Incorrect OTP. Check and try again.',
    'auth/code-expired':              'OTP has expired. Request a new one.',
    'auth/missing-verification-code': 'Please enter the 6-digit OTP.',
    'auth/network-request-failed':    'Network error. Check your connection.',
    'auth/captcha-check-failed':      'reCAPTCHA verification failed. Try again.',
    'auth/web-storage-unsupported':   'Enable cookies/storage to use phone sign-in.',
  };
  return map[code] ?? 'Authentication failed. Please try again.';
}
