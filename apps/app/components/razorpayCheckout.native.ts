import RazorpayCheckout from 'react-native-razorpay';

export function openRazorpayCheckout(options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
}) {
  return RazorpayCheckout.open(options);
}
