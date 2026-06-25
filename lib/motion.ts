/*
 * Shared motion language. One set of spring presets so every surface moves with
 * the same physical character — settled, weighty, never bouncy-cartoonish. Use
 * these instead of hand-tuning transitions per component so the whole app feels
 * like one material. Respects prefers-reduced-motion via Motion's defaults.
 */
import type { Transition, Variants } from "motion/react";

/** The house spring. Calm, a little weight, settles cleanly. For most enter/move. */
export const spring: Transition = { type: "spring", stiffness: 320, damping: 32, mass: 0.9 };

/** Softer, slower — for large surfaces (cards, banners) so they glide. */
export const springSoft: Transition = { type: "spring", stiffness: 210, damping: 30, mass: 1 };

/** Snappy — for taps, toggles, small controls that should feel responsive. */
export const springSnappy: Transition = { type: "spring", stiffness: 520, damping: 30 };

/** A value moment (capital lands, score crosses): a touch of life, still adult. */
export const springPop: Transition = { type: "spring", stiffness: 420, damping: 20, mass: 0.8 };

/** Standard "rise into place" — opacity + a short lift. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** A list container that staggers its children in. Pair with `riseItem`. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring },
};

/** Press feedback for buttons/cards. Spread onto a motion element. */
export const press = { whileTap: { scale: 0.97 }, transition: springSnappy } as const;
