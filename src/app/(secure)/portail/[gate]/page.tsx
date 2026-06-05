import { notFound } from "next/navigation";
import { adminGateSlug, adminPassphrase } from "@/lib/auth/admin-gate";
import { AdminGateForm } from "@/components/admin/admin-gate-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Accès",
  robots: { index: false, follow: false },
};

export default function AdminGatePage({
  params,
}: {
  params: { gate: string };
}) {
  // Toute URL qui ne correspond pas exactement au slug secret → 404.
  if (params.gate !== adminGateSlug()) notFound();

  return (
    <AdminGateForm gate={params.gate} requirePassphrase={adminPassphrase() !== null} />
  );
}
