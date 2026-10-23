export function openRazorpayCheckout(options: Record<string, unknown>) {
  return new Promise<Record<string, string>>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Checkout is unavailable'));

    const launch = () => {
      if (!window.Razorpay) return reject(new Error('Razorpay checkout could not be loaded'));
      const razorpay = new window.Razorpay({
        ...options,
        handler: resolve,
        modal: {
          ...(options.modal as Record<string, unknown> | undefined),
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
      });
      razorpay.open();
    };

    if (window.Razorpay) return launch();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = launch;
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}
