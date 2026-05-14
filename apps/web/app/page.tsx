'use client'

import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
} from '@hocuspocus/provider-react'
import Editor from './components/Editor';

export default function Home() {
  return (
    <HocuspocusProviderWebsocketComponent url="ws://127.0.0.1:1234">
      <HocuspocusRoom name="example-document">
        <Editor />
      </HocuspocusRoom>
    </HocuspocusProviderWebsocketComponent>
  );
}
