import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/overview");
  return <LoginForm />;
}
