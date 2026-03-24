import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PreviewWebNoticeContext = createContext(null);

export function PreviewWebNoticeProvider({ children }) {
  const [dismissed, setDismissed] = useState(false);
  const dismiss = useCallback(() => setDismissed(true), []);
  const value = useMemo(() => ({ dismissed, dismiss }), [dismissed, dismiss]);
  return <PreviewWebNoticeContext.Provider value={value}>{children}</PreviewWebNoticeContext.Provider>;
}

export function usePreviewWebNoticeDismissal() {
  const ctx = useContext(PreviewWebNoticeContext);
  if (!ctx) return { dismissed: false, dismiss: () => {} };
  return ctx;
}
