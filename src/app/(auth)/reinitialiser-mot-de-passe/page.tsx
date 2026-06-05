import { ResetForm } from "@/components/auth/reset-form";

export const metadata = { title: "Réinitialiser le mot de passe · Callpme" };
export const dynamic = "force-dynamic";

export default function ReinitialiserPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <ResetForm token={searchParams.token ?? ""} />;
}
