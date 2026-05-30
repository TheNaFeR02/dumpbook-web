// Keep in sync with apps/server/src/tiers.ts
export const TIERS = {
  local: { wordLimit: 1_000,    charLimit: 6_000 },
  sync:  { wordLimit: 2_000,    charLimit: 12_000 },
  full:  { wordLimit: 50_000,   charLimit: 300_000 },
} as const

export type TierName = keyof typeof TIERS
export type Tier = typeof TIERS[TierName]
export type TierLimits = { wordLimit: number; charLimit: number }
