import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: 'border border-transparent bg-gradient-to-r from-[#8f87df] to-[#5f9df5] text-white shadow-[0_18px_34px_rgba(95,157,245,0.32)] hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(95,157,245,0.36)]',
  secondary: 'border border-white/70 bg-white/75 text-slate-700 shadow-[0_14px_28px_rgba(138,155,200,0.14)] hover:bg-white/90',
  outline: 'border border-[#6ea1ef]/35 bg-white/50 text-[#5f88d9] hover:bg-white/80',
  ghost: 'border border-transparent bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-[15px]',
  lg: 'px-8 py-3.5 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        rounded-full font-semibold transition-all duration-200 backdrop-blur-md
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
}
