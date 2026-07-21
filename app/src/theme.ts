// Ember & Parchment design tokens — mirrors faven-landing_4.html [data-theme="ember"]
import { Platform } from 'react-native';

export const colors = {
  espresso: '#1B151C',
  espresso2: '#241C26',
  accent: '#E15544',
  accentInk: '#B33726',
  accentHover: '#C23F30',
  accentTint: '#FBE1DC',
  accent2: '#C98A4B',
  // Darker amber for TEXT on light backgrounds — accent2 (#C98A4B) is only
  // 2.74:1 on paper2 and fails WCAG AA. accent2Ink is ≥5.4:1 on paper/paper2.
  accent2Ink: '#8A5A24',
  green: '#3E7D5A',
  greenDeep: '#2B5940',
  paper: '#F5F1E8',
  paper2: '#FAF8F2',
  ink: '#1F1A1C',
  inkSoft: '#6B6165',
  // Landing-page derived lines/overlays (faven-landing_4.html)
  linePaper: 'rgba(31,26,28,0.14)', // hairline borders on paper
  lineDark: 'rgba(245,241,232,0.14)', // hairline borders on espresso
  onDark: 'rgba(245,241,232,0.74)', // secondary text on espresso
  onDarkSoft: 'rgba(245,241,232,0.48)', // tertiary text on espresso
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

// Landing page pairs a serif display with mono "receipt" labels. On native we
// lean on system fonts that carry the same voice.
export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) as string,
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'JetBrains Mono, monospace' }) as string,
};

// Typography scale (Sprint 4 polish) — one source of truth for font sizing.
export const typeScale = {
  display: { fontSize: 44, fontWeight: '800' as const },
  h1: { fontSize: 24, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  meta: { fontSize: 13, fontWeight: '400' as const },
  badge: { fontSize: 11, fontWeight: '700' as const },
};

// Badge colors chosen for WCAG AA on white text (≥4.5:1), except `partial`
// which uses dark ink text on the amber background (5.9:1).
export const tierColors: Record<string, string> = {
  full: colors.greenDeep,
  partial: colors.accent2,
  reviewed: colors.inkSoft,
};

// Text color to pair with each tier badge background.
export const tierTextColors: Record<string, string> = {
  full: '#FFFFFF',
  partial: colors.ink,
  reviewed: '#FFFFFF',
};

export const tierLabels: Record<string, string> = {
  full: 'Fully Verified',
  partial: 'Partially Verified',
  reviewed: 'Reviewed',
};
