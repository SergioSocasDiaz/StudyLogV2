import type { SelectHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn, focusRing } from './cn';

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id?: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  options: readonly string[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, hint, error, options, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink" htmlFor={fieldId}>
        {label}
      </label>

      <select
        {...rest}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink',
          error && 'border-danger',
          focusRing,
          className,
        )}
        id={fieldId}
        ref={ref}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {hint ? (
        <p className="text-xs leading-relaxed text-ink-muted" id={hintId}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
});
