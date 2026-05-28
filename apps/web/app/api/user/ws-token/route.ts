import { NextResponse } from "next/server"
import { auth } from "@/app/lib/auth"
import { headers } from "next/headers"
import { signWsToken } from "@/app/lib/ws-token"
import { resolveUserTier } from "@/app/lib/subscription"

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return NextResponse.json({ token: signWsToken('anonymous') })
    }

    const tier = await resolveUserTier(session.user.id)
    return NextResponse.json({ token: signWsToken(tier) })
}
