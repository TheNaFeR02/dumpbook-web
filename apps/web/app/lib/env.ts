import { z } from 'zod'

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.url('BETTER_AUTH_URL must be a valid URL'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  POLAR_ACCESS_TOKEN: z.string().min(1, 'POLAR_ACCESS_TOKEN is required'),
  POLAR_PRODUCT_ID: z.string().min(1, 'POLAR_PRODUCT_ID is required'),
  POLAR_WEBHOOK_SECRET: z.string().min(1, 'POLAR_WEBHOOK_SECRET is required'),
  HOCUSPOCUS_SECRET: z.string().min(1, 'HOCUSPOCUS_SECRET is required'),
  POLAR_SERVER: z.enum(['sandbox', 'production']).default('sandbox'),
})

export default envSchema.parse(process.env)
