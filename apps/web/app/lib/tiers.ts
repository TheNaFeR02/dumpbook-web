// Keep in sync with apps/server/src/tiers.ts
export const TIERS = {
  local: { wordLimit: 1_000,    charLimit: 6_000 },
  sync:  { wordLimit: 2_000,    charLimit: 12_000 },
  full:  { wordLimit: Infinity, charLimit: Infinity },
} as const

export type TierName = keyof typeof TIERS
export type Tier = typeof TIERS[TierName]
