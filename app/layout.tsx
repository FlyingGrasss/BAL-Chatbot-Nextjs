import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BAL Asistan",
  description: "Bornova Anadolu Lisesi chatbot",
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
