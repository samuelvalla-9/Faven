// Ember & Parchment design tokens — mirrors faven-landing_4.html [data-theme="ember"]
export const colors = {
  espresso: '#1B151C',
  espresso2: '#241C26',
  accent: '#E15544',
  accentInk: '#B33726',
  accentHover: '#C23F30',
  accentTint: '#FBE1DC',
  accent2: '#C98A4B',
  green: '#3E7D5A',
  greenDeep: '#2B5940',
  paper: '#F5F1E8',
  paper2: '#FAF8F2',
  ink: '#1F1A1C',
  inkSoft: '#6B6165',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const tierColors: Record<string, string> = {
  full: colors.green,
  partial: colors.accent2,
  reviewed: colors.inkSoft,
};

export const tierLabels: Record<string, string> = {
  full: 'Fully Verified',
  partial: 'Partially Verified',
  reviewed: 'Reviewed',
};
