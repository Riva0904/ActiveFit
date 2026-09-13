import { Alert, Linking } from 'react-native';
import { api } from './api';
import { buildUpiIntent, describeUpiCheckout, parseUpiCheckout, UpiCheckout } from './upi';

interface PromptOptions {
  /** Short reference shown in the UPI app's note field. */
  note?: string;
  /** Called after the member confirms and the backend has flagged the payment. */
  onPaid: (checkout: UpiCheckout) => void;
  onCancel?: () => void;
}

/**
 * Standard manual-UPI dialog: open the UPI app via deep link (optional), then let
 * the member mark the payment as sent. Marking calls POST /payments/:id/mark-paid,
 * which puts the payment in the gym admin's confirmation queue — without that call
 * the admin never sees it, and nothing is fulfilled.
 */
export function presentUpiCheckout(res: unknown, opts: PromptOptions): boolean {
  const checkout = parseUpiCheckout(res);
  if (!checkout) {
    Alert.alert('Payment unavailable', 'This gym has not set up UPI payments yet. Please pay at the front desk.');
    return false;
  }

  const markPaid = async () => {
    try {
      await api.post(`/payments/${checkout.paymentId}/mark-paid`, {});
      opts.onPaid(checkout);
    } catch (e: any) {
      Alert.alert('Could not record payment', e?.message ?? 'Please try again or contact the gym.');
    }
  };

  const openUpiApp = async () => {
    const url = buildUpiIntent(checkout, opts.note);
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('No UPI app found', `Pay manually to ${checkout.vpa}`);
    } catch {
      Alert.alert('Could not open UPI app', `Pay manually to ${checkout.vpa}`);
    }
    // Re-show the confirmation so the member can mark it once they return.
    Alert.alert('Confirm payment', describeUpiCheckout(checkout), [
      { text: 'Not yet', style: 'cancel', onPress: opts.onCancel },
      { text: "I've paid", onPress: markPaid },
    ]);
  };

  Alert.alert('UPI Payment', describeUpiCheckout(checkout), [
    { text: 'Cancel', style: 'cancel', onPress: opts.onCancel },
    { text: 'Open UPI app', onPress: openUpiApp },
    { text: "I've paid", onPress: markPaid },
  ]);
  return true;
}
