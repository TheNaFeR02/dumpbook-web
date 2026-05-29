export const TIERS = {
  anonymous:     { wordLimit: 1000, charLimit: 6000 },
  authenticated: { wordLimit: Infinity, charLimit: Infinity },
} as const

export type TierName = keyof typeof TIERS
export type Tier = typeof TIERS[TierName]
