import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AuthModalContextValue = {
  isOpen: boolean;
  reason: string | null;
  open: (reason?: string) => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      isOpen,
      reason,
      open: (r?: string) => {
        setReason(r ?? null);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, reason],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
