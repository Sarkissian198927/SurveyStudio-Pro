import type { ReactNode } from 'react';
export function LoadingState({children}:{children:ReactNode}) {
  return <div className="center-screen" role="status" aria-live="polite">{children}</div>;
}
