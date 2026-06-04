import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  if (await getSession()) redirect("/overview");
  return <RegisterForm plan={searchParams.plan} />;
}
