export const easing = [0.22, 1, 0.36, 1] as const
export const timings = { feedback: 0.14, panel: 0.24, page: 0.3 }

export const pageMotion = (reduced: boolean) => ({
  initial: { opacity: 0, y: reduced ? 0 : 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: reduced ? 0 : -4 },
  transition: { duration: reduced ? 0.08 : timings.page, ease: easing },
})
