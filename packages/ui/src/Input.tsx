import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-500">{label}</label>
      )}
      <input
        className={`
          w-full rounded-[22px] border border-[rgba(127,156,224,0.2)] bg-white/78 px-4 py-3.5
          text-slate-700 placeholder:text-slate-400
          shadow-[0_14px_28px_rgba(135,151,192,0.12)] backdrop-blur-md
          focus:outline-none focus:ring-2 focus:ring-[#76a7f1] focus:border-transparent
          transition-all duration-200
          ${error ? 'border-red-400 focus:ring-red-400' : ''}
          ${className}
        `.trim()}
        {...props}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
