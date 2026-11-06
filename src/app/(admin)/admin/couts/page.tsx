import { prisma } from "@/lib/db/client";
import { parseCosts } from "@/lib/costs/meter";
import { fixedCostsEur, minuteCostEur, planMargin, project, REFERENCE, TTS_USD_PER_1K_PRUDENT } from "@/lib/costs/economics";
import { usdToEur } from "@/lib/costs/prices";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Coûts & rentabilité" };
export const dynamic = "force-dynamic";

const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const SUBSCRIBERS = [10, 100, 200];
const PRO_SHARE = 0.3;

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 font-medium ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminCostsPage() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const calls = await prisma.call.findMany({
    where: { createdAt: { gte: since }, costs: { not: null } },
    select: { costs: true, agent: { select: { organizationId: true, organization: { select: { name: true } } } } },
  });

  // Coût réel mesuré sur les appels des 30 derniers jours.
  let minutes = 0;
  let ttsChars = 0;
  let llmUsd = 0;
  const byOrg = new Map<string, { name: string; calls: number; minutes: number; eur: number }>();
  for (const c of calls) {
    const k = parseCosts(c.costs);
    if (!k) continue;
    const m = k.units.durationSec / 60;
    minutes += m;
    ttsChars += k.units.ttsChars;
    llmUsd += k.usd.llm;
    const orgId = c.agent.organizationId;
    const o = byOrg.get(orgId) ?? { name: c.agent.organization.name, calls: 0, minutes: 0, eur: 0 };
    o.calls++;
    o.minutes += m;
    o.eur += k.eur;
    byOrg.set(orgId, o);
  }
  // Assez d'appels réels : la consommation observée remplace la mesure de référence.
  const observed = minutes >= 30;
  const minute = minuteCostEur(observed ? { llmUsdPerMin: llmUsd / minutes, ttsCharsPerMin: ttsChars / minutes } : {});
  const per = minute.total;
  const margins = [1, 0.5].flatMap((u) => (["starter", "pro"] as const).map((p) => ({ u, m: planMargin(p, u, per) })));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Coûts & rentabilité"
        description="Ce que coûte réellement une minute d'appel, ce que rapporte chaque offre, et le bénéfice selon le nombre d'abonnés."
      />

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Coût d&apos;une minute d&apos;appel (entrant, numéro français)</h2>
        <p className="text-sm text-muted-foreground">
          {observed
            ? `Calculé sur ${Math.round(minutes)} minutes d'appels réels des 30 derniers jours.`
            : `Mesure de référence : conversation de service client rejouée avec les vraies API (Claude Haiku, ${REFERENCE.ttsCharsPerMin} caractères de voix par minute). Elle est remplacée automatiquement par vos appels réels dès 30 minutes enregistrées.`}
        </p>
        <Table
          head={["Poste", "Par minute"]}
          rows={[
            ["Intelligence (Claude)", eur(minute.llm, 4)],
            [`Voix (ElevenLabs, ${TTS_USD_PER_1K_PRUDENT} $ / 1 000 caractères)`, eur(minute.tts, 4)],
            ["Transcription (Deepgram)", eur(minute.stt, 4)],
            ["Téléphonie (Twilio, entrant + flux audio)", eur(minute.telephony, 4)],
            ["Total", eur(per, 4)],
          ]}
        />
        <Table
          head={["Autres canaux", "Par minute"]}
          rows={[
            ["Widget du site / test navigateur (sans téléphone)", eur(minuteCostEur({ channel: "web" }).total, 4)],
            ["Appel sortant vers un mobile français", eur(minuteCostEur({ channel: "outbound", to: "+336" }).total, 4)],
            ["Appel sortant vers un mobile au Bénin", eur(minuteCostEur({ channel: "outbound", to: "+229" }).total, 4)],
            ["Appel sortant vers un mobile en Côte d'Ivoire", eur(minuteCostEur({ channel: "outbound", to: "+225" }).total, 4)],
          ]}
        />
        <p className="text-xs text-muted-foreground">Prix des fournisseurs relevés le 6 novembre 2026 ; 1 $ = {usdToEur()} €.</p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Ce que rapporte un abonné par mois</h2>
        <Table
          head={["Offre", "Minutes utilisées", "Prix", "Coût des minutes", "Numéros", "Frais de paiement", "Il nous reste"]}
          rows={margins.map(({ u, m }) => [
            `${m.plan === "pro" ? "Pro" : "Starter"} (${u === 1 ? "toutes les minutes" : "la moitié"})`,
            m.minutesUsed,
            eur(m.price),
            eur(m.minutesCost),
            eur(m.numbersCost),
            eur(m.paymentFee),
            eur(m.margin),
          ])}
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Bénéfice mensuel selon le nombre d&apos;abonnés</h2>
        <p className="text-sm text-muted-foreground">
          Hypothèse : {Math.round((1 - PRO_SHARE) * 100)} % d&apos;abonnés Starter et {Math.round(PRO_SHARE * 100)} % Pro. Frais fixes
          compris (site, base de données, serveur vocal, e-mails), hors impôts et salaires.
        </p>
        {[0.5, 1].map((u) => (
          <div key={u} className="space-y-2">
            <h3 className="text-sm font-medium">{u === 1 ? "Si chaque abonné utilise toutes ses minutes" : "Si chaque abonné utilise la moitié de ses minutes"}</h3>
            <Table
              head={["Abonnés", "Chiffre d'affaires", "Coûts des appels", "Frais fixes", "Bénéfice"]}
              rows={SUBSCRIBERS.map((n) => {
                const x = project(n, { proShare: PRO_SHARE, usage: u, perMinuteEur: per });
                return [n, eur(x.revenue, 0), eur(x.variableCosts, 0), eur(x.fixedCosts, 0), eur(x.profit, 0)];
              })}
            />
          </div>
        ))}
        <Table head={["Frais fixes (100 abonnés)", "Par mois"]} rows={fixedCostsEur(100).items.map((i) => [i.label, eur(i.eur)])} />
      </Card>

      {byOrg.size > 0 && (
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Coût réel par client (30 derniers jours)</h2>
          <Table
            head={["Organisation", "Appels", "Minutes", "Coût réel"]}
            rows={Array.from(byOrg.values())
              .sort((a, b) => b.eur - a.eur)
              .map((o) => [o.name, o.calls, Math.round(o.minutes), eur(o.eur)])}
          />
        </Card>
      )}
    </div>
  );
}
