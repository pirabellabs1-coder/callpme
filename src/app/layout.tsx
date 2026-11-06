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
    default: "Callpme — Agents vocaux IA pour les entreprises",
    template: "%s · Callpme",
  },
  description:
    "Callpme répond à vos appels avec un agent vocal IA : prise de rendez-vous, qualification, support et transfert. Pour les PME, les agences et les développeurs, en Europe et en Afrique francophone.",
  keywords: [
    "agent vocal IA",
    "standard téléphonique IA",
    "callbot",
    "voicebot francophone",
    "automatisation des appels",
  ],
  authors: [{ name: "Callpme" }],
  metadataBase: new URL("https://callpme.fr"),
  openGraph: {
    title: "Callpme — Agents vocaux IA",
    description:
      "Un agent vocal IA qui répond à vos appels, prend les rendez-vous et résume chaque conversation. En Europe et en Afrique francophone.",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
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
