import { SelectHTMLAttributes, forwardRef, useId, ReactNode } from 'react';
import clsx from 'clsx';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            htmlFor={selectId}
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
        <select
          ref={ref}
          id={selectId}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '10px',
            fontSize: '15px',
            backgroundColor: 'var(--surface)',
            border: error ? '1px solid var(--error)' : '1px solid var(--border)',
            color: 'var(--foreground)',
            transition: 'all 0.2s',
            cursor: 'pointer',
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
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
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
        {helperText && !error && (
          <p style={{
            marginTop: '8px',
            fontSize: '13px',
            color: 'var(--text-tertiary)'
          }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
