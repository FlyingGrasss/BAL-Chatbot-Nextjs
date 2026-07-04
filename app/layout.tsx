import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BAL Asistan — Bornova Anadolu Lisesi",
  description: "Bornova Anadolu Lisesi için RAG destekli sohbet asistanı",
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
