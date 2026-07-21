---
applyTo: "app/**/*.{ts,tsx}"
---

# Faven app (React Native / Expo) design rules

- Follow the **Ember & Parchment** design language from `faven-landing_4.html`: espresso dark bands, parchment paper surfaces, receipt/stamp motifs, serif display headings + mono meta labels.
- Use design tokens from `app/src/theme.ts` (`colors`, `spacing`, `radius`, `fonts`, `typeScale`) — never hard-code hex values or magic numbers in components.
- Use the animation toolkit in `app/src/motion.tsx` (`FadeInUp`, `ScalePressable`, `Pulse`, `PopIn`, `useBounce`) for any motion. All animations must respect reduce-motion (the toolkit handles this) and use the native driver.
- Maintain WCAG AA contrast: use `accentInk`/`accent2Ink` for text on paper, not raw `accent`/`accent2`.
- Keep interactions tactile: pressables get spring feedback, lists get staggered entrances, loading states get pulsing skeletons.
