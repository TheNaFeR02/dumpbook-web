import type { Metadata, Viewport } from "next";
import localFont from 'next/font/local'
import "./globals.css"

export const metadata: Metadata = {
  title: "Dumpbook",
  description: "Dumping thoughts.",
  appleWebApp: { capable: true, title: "Dumpbook", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lay out under notches/status bars; globals.css pads with safe-area insets.
  viewportFit: "cover",
  // Android: the on-screen keyboard shrinks the layout instead of overlaying
  // it, so the caret in the (fixed-height) editor stays visible while typing.
  interactiveWidget: "resizes-content",
};

const iAWriterDuospacefont = localFont({
  src: [
    {
      path: './fonts/iAWriterDuospace-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/iAWriterDuospace-RegularItalic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/iAWriterDuospace-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/iAWriterDuospace-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-duospace',
})
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${iAWriterDuospacefont.className} ${iAWriterDuospacefont.variable}`} suppressHydrationWarning>
      <head>
        {/* Colors the installed app's title/status bar; kept in sync with the theme below and in Editor's toggle. */}
        <meta name="theme-color" content="#ffffff" />
        <script
          // Set the theme before first paint to avoid a flash of the wrong mode.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dumpbook-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);document.querySelector('meta[name="theme-color"]').setAttribute('content',t==='dark'?'#161618':'#ffffff');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
