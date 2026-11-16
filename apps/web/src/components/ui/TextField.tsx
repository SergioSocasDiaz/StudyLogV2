import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';

import { cn, focusRing } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  label: string;
  /** Help text shown before the user makes a mistake (password rules, format). */
  hint?: string;
  error?: string | undefined;
  /** Optional control aligned with the label, such as a password toggle. */
  action?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, hint, error, action, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-ink" htmlFor={fieldId}>
          {label}
        </label>
        {action}
      </div>

      <input
        {...rest}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/70',
          error && 'border-danger',
          focusRing,
          className,
        )}
        id={fieldId}
        ref={ref}
      />

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
