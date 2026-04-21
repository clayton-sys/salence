import { formatHex, oklch, parse, formatCss } from 'culori'

export interface ThemeTokens {
  accent: string
  accentHover: string
  accentMuted: string
  accentGlow: string
  accentDeep: string
  accentGradient: string
}

export interface ThemeSeed {
  name: string
  hex: string
}

// 14 curated seeds validated to read well against the dark shell.
export const THEME_SEEDS: ThemeSeed[] = [
  { name: 'Solar Gold', hex: '#E9C03A' },
  { name: 'Cerulean', hex: '#3A6B8A' },
  { name: 'Coral', hex: '#FF6B6B' },
  { name: 'Mint', hex: '#4ECDC4' },
  { name: 'Lavender', hex: '#B28DFF' },
  { name: 'Rose', hex: '#FF85A1' },
  { name: 'Amber', hex: '#FFA726' },
  { name: 'Sage', hex: '#87A96B' },
  { name: 'Sky', hex: '#64B5F6' },
  { name: 'Magenta', hex: '#E91E63' },
  { name: 'Teal', hex: '#26A69A' },
  { name: 'Lime', hex: '#C6FF00' },
  { name: 'Cream', hex: '#FFE5B4' },
  { name: 'Ruby', hex: '#D32F2F' },
]

const DEFAULT_SEED = '#E9C03A'

function clampL(l: number) {
  return Math.max(0.05, Math.min(0.95, l))
}

// Derive all six accent tokens from a seed hex. We work in OKLCH so lightness
// shifts stay perceptually even across the whole palette.
export function deriveTheme(seedHex: string): ThemeTokens {
  const parsed = parse(seedHex) || parse(DEFAULT_SEED)
  const base = oklch(parsed)
  if (!base) {
    // Fallback if culori couldn't parse
    return deriveTheme(DEFAULT_SEED)
  }

  const l = base.l ?? 0.7
  const c = base.c ?? 0.1
  const h = base.h ?? 0

  const hover = { mode: 'oklch' as const, l: clampL(l + 0.05), c, h }
  const deep = { mode: 'oklch' as const, l: clampL(l - 0.15), c, h }

  const accentHex = formatHex(base) || seedHex
  const hoverHex = formatHex(hover) || accentHex
  const deepHex = formatHex(deep) || accentHex

  // For translucent tokens we want an rgba-style string so CSS can compose it
  // over any surface. formatCss on an oklch with alpha produces `oklch(...)`
  // which browsers accept.
  const mutedCss =
    formatCss({ mode: 'oklch', l, c, h, alpha: 0.3 }) ||
    `${accentHex}4d`
  const glowCss =
    formatCss({ mode: 'oklch', l, c, h, alpha: 0.15 }) ||
    `${accentHex}26`

  return {
    accent: accentHex,
    accentHover: hoverHex,
    accentMuted: mutedCss,
    accentGlow: glowCss,
    accentDeep: deepHex,
    accentGradient: `linear-gradient(135deg, ${accentHex} 0%, ${deepHex} 100%)`,
  }
}

export const THEME_VAR_MAP: Record<keyof ThemeTokens, string> = {
  accent: '--accent',
  accentHover: '--accent-hover',
  accentMuted: '--accent-muted',
  accentGlow: '--accent-glow',
  accentDeep: '--accent-deep',
  accentGradient: '--accent-gradient',
}

export function themeStyleVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--accent': tokens.accent,
    '--accent-hover': tokens.accentHover,
    '--accent-muted': tokens.accentMuted,
    '--accent-glow': tokens.accentGlow,
    '--accent-deep': tokens.accentDeep,
    '--accent-gradient': tokens.accentGradient,
    // legacy mirrors so existing CSS that uses --user-color keeps working
    '--user-color': tokens.accent,
    '--user-color-dim': tokens.accentMuted,
    '--user-color-border': tokens.accentMuted,
    '--user-color-glow': tokens.accentGlow,
  }
}
