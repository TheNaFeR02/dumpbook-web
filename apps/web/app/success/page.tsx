export default function SuccessPage() {
  return (
    <main style={{ textAlign: 'center', paddingTop: '20vh', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Welcome to Full Archive
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Your subscription is active. All your writing history is now unlocked.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.6rem 1.25rem',
          background: '#111',
          color: '#fff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Back to writing →
      </a>
    </main>
  )
}
