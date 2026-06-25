"use client";

import { AnimatePresence, motion } from "motion/react";
import { useFinancier } from "@/components/FinancierProvider";
import { springSoft } from "@/lib/motion";

/*
 * A financier whose console has no real borrowers yet sees a seeded sample desk
 * so the surface is not empty. Real importers appear as they onboard and settle;
 * "Start blank" dismisses the sample.
 */
export function FinancierSampleBanner() {
  const { isSample, startReal } = useFinancier();

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
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">This is a sample desk.</span> These borrowers are
              seeded so you can see the console. Real importers appear here as they settle on Dhow.
            </p>
            <button
              onClick={startReal}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-3 transition-colors hover:text-ink"
            >
              Start blank
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
