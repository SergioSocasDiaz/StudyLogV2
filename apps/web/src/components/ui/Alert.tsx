import type { ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from './cn';

type AlertTone = 'error' | 'info';

export interface AlertProps {
  tone?: AlertTone;
  className?: string;
  children: ReactNode;
}

const TONES: Record<AlertTone, string> = {
  error: 'border-danger/40 bg-danger/5 text-danger',
  info: 'border-accent/30 bg-accent/5 text-accent',
};

/**
 * Form-level message.
 *
 * Errors use `role="alert"` so a screen reader announces them as soon as they
 * appear; informational notices use `status` and stay quiet.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { tone = 'error', className, children },
  ref,
) {
  return (
    <div
      className={cn('rounded-md border px-4 py-3 text-sm font-medium', TONES[tone], className)}
      ref={ref}
      role={tone === 'error' ? 'alert' : 'status'}
      tabIndex={-1}
    >
      {children}
    </div>
  );
});
