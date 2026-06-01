import { NextResponse } from 'next/server'
import { auth, polarClient } from '@/app/lib/auth'
import env from '@/app/lib/env'
import { headers } from 'next/headers'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checkout = await polarClient.checkouts.create({
    products: [env.POLAR_PRODUCT_ID],
    externalCustomerId: session.user.id,
    customerEmail: session.user.email,
    customerName: session.user.name,
    successUrl: `${env.BETTER_AUTH_URL}/success?checkout_id={CHECKOUT_ID}`,
    returnUrl: env.BETTER_AUTH_URL,
    embedOrigin: env.BETTER_AUTH_URL,
  })

  return NextResponse.json({ checkoutUrl: checkout.url })
}
