'use client'

// First-run placeholder, "annotated note" approach — recreates Andrej's
// hand-drawn diagram: a sample note framed by three annotations that show the
// physics of the system (append at the top, gravity pulling down the left,
// review curving back up the right). Purely visual; clears on first keystroke.
export default function EditorPlaceholderDiagram() {
  return (
    <div className="phd" aria-hidden="true">
      <div className="phd-stage">
        {/* append — points to the top of the note */}
        <span className="phd-anno phd-append">
          append
          <svg viewBox="0 0 60 34" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M58 6 C30 2 14 10 6 26" strokeLinecap="round" />
            <path d="M4 14 L5 27 L17 24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>

        {/* gravity — long arrow falling down the left margin */}
        <span className="phd-anno phd-gravity">
          <svg viewBox="0 0 28 230" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 6 C9 70 19 150 14 210" strokeLinecap="round" />
            <path d="M5 196 L14 214 L23 196" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          gravity
        </span>

        {/* review — curves from the bottom back up to the top */}
        <span className="phd-anno phd-review">
          <svg viewBox="0 0 70 220" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 210 C-6 150 -6 70 24 12" strokeLinecap="round" />
            <path d="M12 26 L25 9 L38 22" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          review
        </span>

        <div className="phd-card">
          <p className="phd-todo">TODO for today:</p>
          <p className="phd-item phd-done"><span className="phd-check">✓</span> morning exercise</p>
          <p className="phd-item phd-done"><span className="phd-check">✓</span> write a blog post on note taking</p>
          <p className="phd-item">– do actual work</p>
          <p className="phd-gap" />
          <p>Read: Abundance book?</p>
          <p>respond to Stephen</p>
          <p className="phd-gap" />
          <p>set up <span className="phd-link">bearblog.dev</span></p>
          <p className="phd-gap" />
          <p>idea: World of ChatGPT</p>
          <p className="phd-gap" />
          <p>buy razors</p>
          <p>haircut</p>
        </div>

        <p className="phd-start">start typing — this clears itself</p>
      </div>
    </div>
  )
}
