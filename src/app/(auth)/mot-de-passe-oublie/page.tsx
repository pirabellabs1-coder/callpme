import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata = { title: "Mot de passe oublié · Callpme" };
export const dynamic = "force-dynamic";

export default function MotDePasseOubliePage() {
  return <ForgotForm />;
}
