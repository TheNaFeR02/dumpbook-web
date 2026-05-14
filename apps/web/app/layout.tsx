import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dumpbook",
  description: "Collaborative editing with Hocuspocus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
