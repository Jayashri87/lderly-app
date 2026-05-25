import type { Variants } from "framer-motion";

export const motionTiming = {
  micro: 0.18,
  panel: 0.36,
  screen: 0.42
} as const;

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.04
    }
  }
};

export const calmSpring = {
  type: "spring",
  stiffness: 230,
  damping: 28,
  mass: 0.9
} as const;

export const emergencySpring = {
  type: "spring",
  stiffness: 330,
  damping: 24,
  mass: 0.75
} as const;
