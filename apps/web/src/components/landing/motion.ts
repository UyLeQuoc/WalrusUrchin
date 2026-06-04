import type { Variants } from "framer-motion"

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    transition: { duration: 0.55, ease: "easeOut" },
    y: 0,
  },
} satisfies Variants

export const staggerContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
} satisfies Variants
