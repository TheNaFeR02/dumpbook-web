'use client'

import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor';

export default function Home() {
  
  return (
    <HocuspocusProviderWebsocketComponent url={process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!}>
      <HocuspocusRoom name="example-document">
        <Editor />
      </HocuspocusRoom>
    </HocuspocusProviderWebsocketComponent>
  );
}
