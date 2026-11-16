import type { ButtonHTMLAttributes } from 'react';

import { cn, focusRing } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner and blocks the button without changing its accessible name. */
  busy?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-border bg-surface text-ink hover:bg-surface-raised',
  ghost: 'text-ink-muted hover:text-ink',
};

export function Button({
  variant = 'primary',
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
        VARIANTS[variant],
        className,
      )}
      disabled={disabled || busy}
      type={rest.type ?? 'button'}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}
