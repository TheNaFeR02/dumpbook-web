import { createAuthClient } from "better-auth/react"
import { polarClient } from "@polar-sh/better-auth/client"

export const authClient = createAuthClient({
    plugins: [polarClient()]
})

// checkoutEmbed is injected by the polarClient plugin but not inferred by createAuthClient's types.
type PolarActions = {
    checkoutEmbed: (data: { slug?: string; products?: string | string[] }) => Promise<unknown>
}

export async function startCheckout(slug: string): Promise<void> {
    try {
        await (authClient as typeof authClient & PolarActions).checkoutEmbed({ slug })
    } catch {
        window.location.href = `/api/auth/checkout?slug=${encodeURIComponent(slug)}`
    }
}
