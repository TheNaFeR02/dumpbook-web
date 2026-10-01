import type { MetadataRoute } from 'next'

// Makes Dumpbook installable as a standalone app (Android/desktop Chrome,
// macOS Safari "Add to Dock", iOS "Add to Home Screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Dumpbook',
    short_name: 'Dumpbook',
    description: 'Dumping thoughts.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Splash screen + initial title bar; the page updates the theme-color meta
    // tag at runtime to follow the in-app light/dark toggle.
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
