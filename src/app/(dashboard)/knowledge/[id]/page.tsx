import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getKnowledgeBase } from "@/lib/db/knowledge";
import { KnowledgeDetail } from "@/components/knowledge/knowledge-detail";

export const metadata = { title: "Base de connaissances" };
export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const kb = await getKnowledgeBase(session.org.id, params.id);
  if (!kb) notFound();

  return <KnowledgeDetail kb={kb} />;
}
