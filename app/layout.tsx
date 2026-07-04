import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bal-asistan.vercel.app"),
  title: "BAL Asistan — Bornova Anadolu Lisesi",
  description: "Bornova Anadolu Lisesi için RAG destekli sohbet asistanı",
  openGraph: {
    title: "BAL Asistan — Bornova Anadolu Lisesi",
    description: "Bornova Anadolu Lisesi için RAG destekli sohbet asistanı",
    url: "https://bal-asistan.vercel.app",
    siteName: "BAL Asistan",
    locale: "tr_TR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BAL Logo",
      },
      {
        url: "/icon.png",
        width: 1280,
        height: 1280,
        alt: "BAL Logo",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
