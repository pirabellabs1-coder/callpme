import { requireSession } from "@/lib/auth/session";
import { listKnowledgeBases } from "@/lib/db/knowledge";
import { PageHeader } from "@/components/dashboard/page-header";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";

export const metadata = { title: "Connaissances" };
export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const session = await requireSession();
  const kbs = await listKnowledgeBases(session.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de connaissances"
        description="Donnez à vos agents des documents pour répondre avec précision (RAG)."
      />
      <KnowledgeList initial={kbs} />
    </div>
  );
}
