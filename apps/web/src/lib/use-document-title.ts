import { useEffect } from 'react';

/** Keeps the tab title in sync with the current page. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
