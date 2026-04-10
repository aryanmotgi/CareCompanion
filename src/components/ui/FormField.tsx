'use client';

import { useId } from 'react';

interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function FormField({ label, type = 'text', value, onChange, placeholder, required, error }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const inputClasses = `w-full rounded-xl border ${error ? 'border-red-500' : 'border-[var(--border)]'} bg-[var(--bg-elevated)] py-3 px-4 text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClasses} resize-none`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={inputClasses}
        />
      )}
      {error && <p id={errorId} role="alert" className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  );
}
