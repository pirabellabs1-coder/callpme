import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Geist en local — aucune dépendance réseau, rendu net et moderne.
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Callpme — Agents vocaux IA pour les entreprises françaises",
    template: "%s · Callpme",
  },
  description:
    "Créez, déployez et orchestrez des agents vocaux IA spécialisés — support, prise de rendez-vous, qualification de leads, vente. La plateforme voix française pour les agences et les entreprises.",
  keywords: [
    "agent vocal IA",
    "standard téléphonique IA",
    "callbot",
    "voicebot français",
    "automatisation des appels",
  ],
  authors: [{ name: "Callpme" }],
  metadataBase: new URL("https://callpme.fr"),
  openGraph: {
    title: "Callpme — Agents vocaux IA",
    description:
      "La plateforme française pour créer et déployer des agents vocaux IA spécialisés par rôle.",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#E8572A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
