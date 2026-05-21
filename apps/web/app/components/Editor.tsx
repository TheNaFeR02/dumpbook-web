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
      <header className='navbar'>
        <div>
          <span>Status: {status} </span>
          <span>{users.length} online</span>
        </div>
        <div className=''>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
            <g className="gear-wrap">
              <rect width="32" height="32" fill="transparent" />
              <path fill="#b6b5b5" fillRule="evenodd" d="M13.003,29.003v-4h-2v2h-4v-2h-2v-4h2v-2h-4v-6h4v-2h-2v-4h2v-2h4v2h2v-4h6v4h2v-2h4v2h2v4h-2v2h4v6h-4v2h2v4h-2v2h-4v-2h-2v4H13.003z M20.003,20.003v-7.999h-8.001v7.999H20.003z" clipRule="evenodd" />
              <path fill="#706d67" fillRule="evenodd" d="M13.003,23.003v-2h-2v-2h-2v-6h2v-2h2v-2h6v2h2v2h2v6h-2v2h-2v2H13.003z M19.003,19.003v-5.999h-6.001v5.999H19.003z" clipRule="evenodd" />
            </g>
          </svg>
        </div>
      </header>
      <EditorContent editor={editor} className="editor-content" />
    </div>

    // <EditorContent editor={editor} />
  )
}

