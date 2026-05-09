import type { Metadata, Viewport } from "next";
import { LderlyProviders } from "../components/LderlyProviders";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lderly-app.vercel.app"),
  title: {
    default: "LDERLY Care",
    template: "%s | LDERLY"
  },
  description: "Book, track, and coordinate trusted elder care for family.",
  applicationName: "LDERLY",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LDERLY",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg"
  },
  openGraph: {
    title: "LDERLY Care",
    description: "Care arrives on demand for parents and families.",
    url: "https://lderly-app.vercel.app",
    siteName: "LDERLY",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050816"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LderlyProviders>{children}</LderlyProviders>
      </body>
    </html>
  );
}
