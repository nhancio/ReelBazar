declare module 'react-native-razorpay' {
  type Options = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
  };

  const RazorpayCheckout: {
    open(options: Options): Promise<{
      razorpay_order_id?: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
    }>;
  };

  export default RazorpayCheckout;
}
