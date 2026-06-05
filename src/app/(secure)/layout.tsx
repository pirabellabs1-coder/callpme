import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accès",
  robots: { index: false, follow: false },
};

export default function SecureLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-foreground px-4 py-10">
      {children}
    </div>
  );
}
