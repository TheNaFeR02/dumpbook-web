'use client'

import { useEffect, useState } from 'react'
import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor'
import { authClient } from './lib/auth-client'

export default function Home() {
  const { data: session, isPending } = authClient.useSession()
  const [roomName, setRoomName] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) return

    if (session?.user) {
      setRoomName(`user-${session.user.id}`)
    } else {
      let anonId = localStorage.getItem('dumpbook_anon_id')
      if (!anonId) {
        anonId = crypto.randomUUID()
        localStorage.setItem('dumpbook_anon_id', anonId)
      }
      setRoomName(`anon-${anonId}`)
    }
  }, [session, isPending])

  if (!roomName) return null

  return (
    <HocuspocusProviderWebsocketComponent key={roomName} url={process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!}>
      <HocuspocusRoom name={roomName}>
        <Editor session={session ?? null} />
      </HocuspocusRoom>
    </HocuspocusProviderWebsocketComponent>
  )
}
