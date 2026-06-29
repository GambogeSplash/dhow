"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCredit } from "@/components/CreditProvider";
import { useOverlays } from "@/components/overlays";
import { springSoft, press } from "@/lib/motion";

/*
 * A freshly onboarded account is empty, which looks dead. Until the user takes
 * their first real action, the dashboard shows seeded sample activity behind
 * this banner so they can see what Dhow becomes. Adding a real supplier (or
 * settling a payment) clears the sample automatically; "Start blank" dismisses
 * it explicitly.
 */
export function SampleBanner() {
  const { isSample, startReal } = useCredit();
  const { openAddSupplier } = useOverlays();

  return (
    <AnimatePresence>
      {isSample && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={springSoft}
          className="border-b border-line bg-surface-sunk"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">This is a sample workspace.</span> It shows what
              Dhow looks like in use. Add your first supplier to start your own.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={startReal}
                className="rounded-full px-3 py-1.5 text-sm text-ink-3 transition-colors hover:text-ink"
              >
                Start blank
              </button>
              <motion.button
                {...press}
                onClick={openAddSupplier}
                className="rounded-full bg-teal px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-deep"
              >
                Add your first supplier
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
