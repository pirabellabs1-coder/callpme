import { CodeBlock, CodeTabs } from "./code-block";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

function DocSection({
  title,
  desc,
  method,
  path,
  children,
}: {
  title: string;
  desc?: string;
  method?: string;
  path?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold tracking-tight text-foreground">{title}</h3>
        {method && path && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[0.7rem]">
            <span className="font-semibold text-brand">{method}</span>
            <span className="text-muted-foreground">{path}</span>
          </span>
        )}
      </div>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Petit tableau de paramètres (champ · type · description). */
function Params({
  rows,
}: {
  rows: { name: string; type: string; required?: boolean; desc: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Champ</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="whitespace-nowrap px-3 py-2 align-top">
                <code className="font-mono text-xs text-foreground">{r.name}</code>
                {r.required && (
                  <span className="ml-1 text-brand" title="Requis">
                    *
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top">
                <code className="font-mono text-[0.7rem] text-muted-foreground">
                  {r.type}
                </code>
              </td>
              <td className="px-3 py-2 align-top text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocsPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const base = `${apiBaseUrl}/api/v1`;

  /* --------------------------- Agents : lister --------------------------- */
  const listCurl = [
    `curl "${base}/agents?role=receptionist&status=active" \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY"`,
  ].join("\n");
  const listJs = [
    `const res = await fetch("${base}/agents?status=active", {`,
    "  headers: { Authorization: `Bearer ${process.env.CALLPME_KEY}` },",
    "});",
    "const { data } = await res.json();",
  ].join("\n");
  const listPy = [
    "import requests",
    "",
    "res = requests.get(",
    `    "${base}/agents",`,
    '    headers={"Authorization": f"Bearer {CALLPME_KEY}"},',
    '    params={"status": "active"},',
    ")",
    'print(res.json()["data"])',
  ].join("\n");
  const listResp = [
    "{",
    '  "data": [',
    "    {",
    '      "id": "agt_8f2c…",',
    '      "name": "Standard Accueil",',
    '      "role": "receptionist",',
    '      "status": "active",',
    '      "phoneNumber": "+33182880000",',
    '      "config": {',
    '        "voice": { "provider": "elevenlabs", "voiceId": "amelie", "language": "fr-FR", "speed": 1 },',
    '        "model": { "provider": "anthropic", "modelId": "claude-3-5-haiku-latest", "temperature": 0.4 },',
    '        "systemPrompt": "Tu es l\'agent d\'accueil de…",',
    '        "firstMessage": "Bonjour, bienvenue chez Acme…",',
    '        "firstSpeaker": "agent",',
    '        "guardrails": [],',
    '        "tools": [],',
    '        "maxDurationSec": 600',
    "      },",
    '      "callsTotal": 42,',
    '      "callsToday": 5,',
    '      "avgDurationSec": 168,',
    '      "resolutionRate": 78,',
    '      "createdAt": "2026-06-01T09:12:00.000Z",',
    '      "updatedAt": "2026-06-02T10:00:00.000Z"',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  /* --------------------------- Agents : créer ---------------------------- */
  const createCurl = [
    `curl -X POST ${base}/agents \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{`,
    `    "name": "Standard Nuit",`,
    `    "role": "receptionist",`,
    `    "status": "active",`,
    `    "firstMessage": "Bonjour, bienvenue chez Acme, comment puis-je vous aider ?",`,
    `    "voice": { "provider": "elevenlabs", "voiceId": "Adélaïde", "language": "fr-FR", "speed": 1 },`,
    `    "model": { "provider": "openai", "modelId": "gpt-4o", "temperature": 0.4 }`,
    `  }'`,
  ].join("\n");
  const createJs = [
    `const res = await fetch("${base}/agents", {`,
    '  method: "POST",',
    "  headers: {",
    "    Authorization: `Bearer ${process.env.CALLPME_KEY}`,",
    '    "Content-Type": "application/json",',
    "  },",
    "  body: JSON.stringify({",
    '    name: "Standard Nuit",',
    '    role: "receptionist",',
    '    firstSpeaker: "agent",',
    '    guardrails: ["Ne jamais donner de conseil médical"],',
    "  }),",
    "});",
    "const { data } = await res.json();",
  ].join("\n");

  /* ------------------------- Agents : mettre à jour ---------------------- */
  const patchCurl = [
    `curl -X PATCH ${base}/agents/AGENT_ID \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"status":"paused"}'`,
  ].join("\n");
  const deleteCurl = [
    `curl -X DELETE ${base}/agents/AGENT_ID \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY"`,
  ].join("\n");
  const getOneCurl = [
    `curl ${base}/agents/AGENT_ID \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY"`,
  ].join("\n");

  /* --------------------------------- Appels ------------------------------ */
  const callsCurl = [
    `curl "${base}/calls?agentId=AGENT_ID&direction=inbound&limit=50" \\`,
    `  -H "Authorization: Bearer $CALLPME_KEY"`,
  ].join("\n");
  const callResp = [
    "{",
    '  "data": {',
    '    "id": "call_3a9…",',
    '    "agentId": "agt_8f2c…",',
    '    "agentName": "Standard Accueil",',
    '    "agentRole": "receptionist",',
    '    "direction": "inbound",',
    '    "fromNumber": "+33600000000",',
    '    "toNumber": "+33182880000",',
    '    "status": "completed",',
    '    "durationSec": 132,',
    '    "outcome": "Rendez-vous pris",',
    '    "summary": "Le client a pris un rendez-vous pour mardi 9h30.",',
    '    "satisfaction": 5,',
    '    "transcript": [',
    '      { "speaker": "agent", "text": "Bonjour…", "at": 0 },',
    '      { "speaker": "caller", "text": "Je voudrais un rendez-vous", "at": 3 },',
    '      { "speaker": "tool", "text": "Rendez-vous créé", "at": 8, "toolName": "book_appointment" }',
    "    ],",
    '    "createdAt": "2026-06-01T09:12:00.000Z"',
    "  }",
    "}",
  ].join("\n");

  /* -------------------------------- Webhooks ----------------------------- */
  const webhookPayload = [
    "{",
    '  "event": "agent.created",',
    '  "data": { "id": "agt_8f2c…", "name": "Standard Nuit" },',
    '  "timestamp": "2026-06-04T10:00:00.000Z"',
    "}",
  ].join("\n");
  const verifyNode = [
    'import crypto from "crypto";',
    "",
    "// body = corps brut de la requête (string)",
    "const expected =",
    '  "sha256=" +',
    '  crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");',
    "",
    'if (expected === req.headers["x-callpme-signature"]) {',
    "  // signature valide — traiter l'événement",
    "}",
  ].join("\n");
  const verifyPy = [
    "import hmac, hashlib",
    "",
    'expected = "sha256=" + hmac.new(',
    "    WEBHOOK_SECRET.encode(), body, hashlib.sha256",
    ").hexdigest()",
    "",
    'if hmac.compare_digest(expected, request.headers["X-Callpme-Signature"]):',
    "    pass  # signature valide",
  ].join("\n");

  return (
    <div className="space-y-9">
      {/* Base & auth */}
      <DocSection
        title="URL de base & authentification"
        desc="Toutes les requêtes de l'API publique passent par l'URL de base ci-dessous et s'authentifient avec une clé secrète dans l'en-tête Authorization."
      >
        <div className="space-y-2">
          <CodeBlock language="http" code={`${base}`} />
          <CodeBlock
            language="http"
            code="Authorization: Bearer cpk_live_votre_cle_secrete"
          />
        </div>
      </DocSection>

      {/* Conventions */}
      <DocSection
        title="Conventions"
        desc="Les réponses encapsulent toujours le résultat dans une clé data. Les erreurs renvoient un objet error (et éventuellement details)."
      >
        <CodeTabs
          samples={[
            {
              label: "Réponse",
              language: "json",
              code: '{ "data": { /* … ou un tableau */ } }',
            },
            {
              label: "Erreur",
              language: "json",
              code: '{ "error": "Message lisible", "details": { /* optionnel */ } }',
            },
          ]}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Codes : <code className="font-mono text-xs">200</code> OK ·{" "}
          <code className="font-mono text-xs">201</code> Créé ·{" "}
          <code className="font-mono text-xs">400</code> Requête invalide ·{" "}
          <code className="font-mono text-xs">401</code> Clé invalide ·{" "}
          <code className="font-mono text-xs">403</code> Limite du forfait ·{" "}
          <code className="font-mono text-xs">404</code> Introuvable.
        </p>
      </DocSection>

      {/* Lister les agents */}
      <DocSection
        title="Lister les agents"
        method="GET"
        path="/api/v1/agents"
        desc="Renvoie tous les agents de votre organisation. Filtres optionnels : role, status (active | paused | draft), search."
      >
        <CodeTabs
          samples={[
            { label: "cURL", language: "bash", code: listCurl },
            { label: "JavaScript", language: "javascript", code: listJs },
            { label: "Python", language: "python", code: listPy },
          ]}
        />
        <div className="mt-3">
          <CodeBlock language="json" code={listResp} />
        </div>
      </DocSection>

      {/* Récupérer un agent */}
      <DocSection
        title="Récupérer un agent"
        method="GET"
        path="/api/v1/agents/:id"
        desc="Renvoie un agent unique avec sa configuration complète."
      >
        <CodeBlock language="bash" code={getOneCurl} />
      </DocSection>

      {/* Créer un agent */}
      <DocSection
        title="Créer un agent"
        method="POST"
        path="/api/v1/agents"
        desc="Le prompt système, la voix et les outils sont générés depuis le rôle, puis personnalisables via les champs ci-dessous."
      >
        <div className="space-y-3">
          <Params
            rows={[
              { name: "name", type: "string", required: true, desc: "Nom de l'agent." },
              {
                name: "role",
                type: "enum",
                required: true,
                desc: "support · appointment · lead_qualification · outbound_sales · receptionist · survey · custom.",
              },
              { name: "status", type: "enum", desc: "active · paused · draft (défaut : draft)." },
              { name: "phoneNumber", type: "string", desc: "Numéro E.164 à assigner." },
              { name: "firstMessage", type: "string", desc: "Phrase d'accueil de l'agent." },
              { name: "firstSpeaker", type: "enum", desc: "agent · caller — qui parle en premier." },
              { name: "guardrails", type: "string[]", desc: "Garde-fous injectés dans le prompt." },
              { name: "persona", type: "string", desc: "Personnalité de l'agent." },
              { name: "customRole", type: "object", desc: "{ label?, description? } — utilisé si role = custom. Champs facultatifs." },
              { name: "tools", type: "string[]", desc: "Noms des outils / fonctions activés." },
              { name: "voice", type: "object", desc: "{ provider (elevenlabs · azure · playht), voiceId, language, speed 0.5–2 }. Champs facultatifs." },
              { name: "model", type: "object", desc: "{ provider (openai · anthropic · mistral), modelId, temperature 0–1 }. Champs facultatifs." },
            ]}
          />
          <CodeTabs
            samples={[
              { label: "cURL", language: "bash", code: createCurl },
              { label: "JavaScript", language: "javascript", code: createJs },
            ]}
          />
        </div>
      </DocSection>

      {/* Mettre à jour */}
      <DocSection
        title="Mettre à jour un agent"
        method="PATCH"
        path="/api/v1/agents/:id"
        desc="Met à jour le nom, le statut (active / paused / draft) ou le numéro."
      >
        <CodeBlock language="bash" code={patchCurl} />
      </DocSection>

      {/* Supprimer */}
      <DocSection
        title="Supprimer un agent"
        method="DELETE"
        path="/api/v1/agents/:id"
        desc="Supprime définitivement l'agent. Déclenche l'événement agent.deleted."
      >
        <CodeBlock language="bash" code={deleteCurl} />
      </DocSection>

      {/* Lister les appels */}
      <DocSection
        title="Lister les appels"
        method="GET"
        path="/api/v1/calls"
        desc="Historique des appels. Filtres : agentId, status (completed | transferred | failed | missed | in_progress), direction (inbound | outbound), limit (défaut 100, max 500)."
      >
        <CodeBlock language="bash" code={callsCurl} />
      </DocSection>

      {/* Récupérer un appel */}
      <DocSection
        title="Récupérer un appel"
        method="GET"
        path="/api/v1/calls/:id"
        desc="Renvoie un appel avec son transcript complet, son issue et sa durée."
      >
        <CodeBlock language="json" code={callResp} />
      </DocSection>

      {/* Webhooks */}
      <DocSection
        title="Webhooks — événements"
        desc="Abonnez un endpoint dans l'onglet Webhooks. Chaque livraison est un POST JSON signé."
      >
        <div className="flex flex-wrap gap-1.5">
          {WEBHOOK_EVENTS.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
            >
              {e.id}
              <span className="font-sans text-muted-foreground/70">· {e.label}</span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Corps de la livraison (en-têtes{" "}
          <code className="font-mono text-xs">X-Callpme-Event</code> et{" "}
          <code className="font-mono text-xs">X-Callpme-Signature</code>) :
        </p>
        <div className="mt-2">
          <CodeBlock language="json" code={webhookPayload} />
        </div>
      </DocSection>

      {/* Vérifier la signature */}
      <DocSection
        title="Vérifier la signature d'un webhook"
        desc="X-Callpme-Signature = HMAC-SHA256 du corps brut, préfixé de « sha256= », avec le secret du webhook."
      >
        <CodeTabs
          samples={[
            { label: "Node.js", language: "javascript", code: verifyNode },
            { label: "Python", language: "python", code: verifyPy },
          ]}
        />
      </DocSection>
    </div>
  );
}
