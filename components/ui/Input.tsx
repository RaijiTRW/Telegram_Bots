import { InputHTMLAttributes, forwardRef, useId } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--foreground)',
              marginBottom: '8px'
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor: 'var(--surface)',
            border: error ? '1px solid var(--error)' : '1px solid var(--border)',
            color: 'var(--foreground)',
            transition: 'all 0.2s',
            outline: 'none',
            ...(props.disabled && {
              opacity: 0.5,
              cursor: 'not-allowed',
              backgroundColor: 'var(--surface-hover)'
            })
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = 'var(--primary)';
              e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? 'var(--error)' : 'var(--border)';
            e.target.style.boxShadow = 'none';
          }}
          className={className}
          {...props}
        />
        {helperText && !error && (
          <p style={{
            marginTop: '8px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            {helperText}
          </p>
        )}
        {error && (
          <p style={{
            marginTop: '8px',
            fontSize: '13px',
            color: 'var(--error)',
            fontWeight: '500'
          }}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
