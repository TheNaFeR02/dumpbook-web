import type { Metadata } from "next";
import localFont from 'next/font/local'
import "./globals.css"

export const metadata: Metadata = {
  title: "Dumpbook",
  description: "Dumping thoughts.",
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
})
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={iAWriterDuospacefont.className}>
      <body
        style={{
          height: "100dvh",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "3rem 1.5rem",
          boxSizing: "border-box",
          margin: 0,
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "680px",
            height: "100%",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
