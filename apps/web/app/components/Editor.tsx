import {
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusAwareness,
  useHocuspocusConnectionStatus,
  useHocuspocusProvider,
} from '@hocuspocus/provider-react'
import { EditorContent, useEditor } from '@tiptap/react'
import Collaboration from '@tiptap/extension-collaboration'
// import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { StarterKit } from '@tiptap/starter-kit'

export default function Editor() {
  const provider = useHocuspocusProvider()
  const status = useHocuspocusConnectionStatus()
  const users = useHocuspocusAwareness()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: provider.document }),
      // CollaborationCaret.configure({
      //   provider,
      //   user: { name: 'John Doe', color: '#ffcc00' },
      // }),
    ],
  })

  return (
    <div className="editor-wrapper">
      <header >
        <span>Status: {status}</span>
        <span>{users.length} online</span>
      </header>
      <EditorContent editor={editor} className="editor-content" />
    </div>

    // <EditorContent editor={editor} />
  )
}

