"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springSoft, springSnappy } from "@/lib/motion";

/*
 * Overlay primitives: a centered Modal and a right-hand Drawer. Both spring in
 * and out via AnimatePresence, lock body scroll, close on Escape or backdrop
 * click, and trap nothing fancy (role=dialog + aria-modal is enough for these
 * short tasks). Use Modal for focused forms, Drawer for a record you study
 * while the list stays behind it.
 */

function useOverlayChrome(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useOverlayChrome(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={springSoft}
            className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-[var(--radius-card)] border border-line bg-paper shadow-xl sm:rounded-[var(--radius-card)] ${maxWidth}`}
          >
            {title && (
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-6 py-4 backdrop-blur">
                <h2 className="font-display text-lg tracking-tight">{title}</h2>
                <CloseButton onClose={onClose} />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useOverlayChrome(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={springSoft}
            className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-paper shadow-2xl ${width}`}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-6 py-4 backdrop-blur">
              <h2 className="font-display text-lg tracking-tight">{title}</h2>
              <CloseButton onClose={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <motion.button
      onClick={onClose}
      whileTap={{ scale: 0.9 }}
      transition={springSnappy}
      aria-label="Close"
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-sunk hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </motion.button>
  );
}
