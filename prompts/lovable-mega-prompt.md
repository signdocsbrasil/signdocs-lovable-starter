# Lovable Mega-Prompt — SignDocs Brasil

Um único prompt para colar no chat de um projeto **Lovable em branco**. Gera a integração SignDocs Brasil completa: tabela Postgres, duas Edge Functions, componentes React e rotas.

**Antes de colar:** adicione os 4 secrets no painel Supabase → Edge Functions → Secrets:

```
SIGNDOCS_CLIENT_ID       = <enviado pela equipe SignDocs>
SIGNDOCS_CLIENT_SECRET   = <enviado pela equipe SignDocs>
SIGNDOCS_BASE_URL        = https://api-hml.signdocs.com.br
SIGNDOCS_WEBHOOK_SECRET  = <deixe vazio por enquanto; preenchemos na etapa final>
```

> ⚠️ HML usa **hífen** (`api-hml`). Com ponto (`api.hml`) dá timeout silencioso — é o erro nº 1.

---

## 👇 Copie tudo abaixo e cole no chat do Lovable

```
Vou adicionar assinatura digital com validade jurídica brasileira (SignDocs Brasil) a este SaaS. A stack é React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (padrão do Lovable).

Gere TODOS os artefatos abaixo em uma única implementação. Respeite os 3 pontos críticos marcados com ⚠️ — eles causam falhas silenciosas se errados.

══════════════════════════════════════════════════
1) TABELA POSTGRES: envelope_status
══════════════════════════════════════════════════

Crie uma migration Supabase:

- Tabela public.envelope_status com colunas:
    session_id     text PRIMARY KEY
    transaction_id text
    user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE
    status         text NOT NULL DEFAULT 'PENDING'
    evidence_id    text
    updated_at     timestamptz NOT NULL DEFAULT now()

- Habilite Row Level Security.
- Policy SELECT "owners read their sessions" com USING (auth.uid() = user_id).
- NÃO crie policy de UPDATE — o webhook usa service_role_key e bypassa RLS.
- Inclua envelope_status na publicação supabase_realtime para updates em tempo real.

══════════════════════════════════════════════════
2) EDGE FUNCTION: create-signing-session
══════════════════════════════════════════════════

Arquivo: supabase/functions/create-signing-session/index.ts

Runtime: Deno. Deploy COM verificação de JWT (padrão, SEM --no-verify-jwt).

Imports:
  import { SignDocsBrasilClient } from "npm:@signdocs-brasil/api@1.3.0";
  import { createClient } from "npm:@supabase/supabase-js@2";

Secrets lidos de Deno.env:
  SIGNDOCS_CLIENT_ID, SIGNDOCS_CLIENT_SECRET, SIGNDOCS_BASE_URL,
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Entrada (POST JSON):
  { signerName, signerEmail, signerCpf?, pdfBase64, filename?, returnUrl }

Fluxo:
  a) Se req.method !== "POST", responder 405.
  b) Extrair Bearer do header Authorization. Chamar
     supabase.auth.getUser(token). Se inválido, 401.
  c) Chamar signdocs.signingSessions.create({
       purpose: "DOCUMENT_SIGNATURE",
       policy:  { profile: "CLICK_ONLY" },
       signer:  { name: signerName, email: signerEmail, cpf: signerCpf,
                  userExternalId: userData.user.id },
       document:{ content: pdfBase64, filename: filename ?? "contrato.pdf" },
       returnUrl,
       locale:  "pt-BR",
     })
  d) ⚠️ CRÍTICO: montar signingUrl = session.url + "?cs=" +
     encodeURIComponent(session.clientSecret). Sem o ?cs a página retorna 401.
  e) Upsert em envelope_status:
     { session_id, transaction_id, user_id: userData.user.id, status: "PENDING" }.
  f) Responder JSON { sessionId, signingUrl, expiresAt }.

══════════════════════════════════════════════════
3) EDGE FUNCTION: signdocs-webhook
══════════════════════════════════════════════════

Arquivo: supabase/functions/signdocs-webhook/index.ts

Runtime: Deno. ⚠️ Deploy COM --no-verify-jwt (webhooks não trazem JWT do Supabase).

Imports:
  import { createClient } from "npm:@supabase/supabase-js@2";
  import { createHmac, timingSafeEqual } from "node:crypto";

Secrets: SIGNDOCS_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Fluxo:
  a) Se req.method !== "POST", responder 405.
  b) Ler headers x-signdocs-signature (sig) e x-signdocs-timestamp (ts).
  c) ⚠️ CRÍTICO: validar janela anti-replay — se |now - ts| > 300s, 401.
  d) Computar HMAC-SHA256 sobre a string literal `${ts}.${body}` (com ponto)
     usando SIGNDOCS_WEBHOOK_SECRET. Comparar com sig usando timingSafeEqual
     (mesmo comprimento, bytes iguais). Se divergir, 401.
  e) Parsear body JSON. Sobre event.eventType:
       SIGNING_SESSION.COMPLETED ou TRANSACTION.COMPLETED:
         UPDATE envelope_status SET status='COMPLETED',
                                     evidence_id=event.data.evidenceId,
                                     updated_at=now()
           WHERE session_id = event.data.sessionId ?? event.transactionId
       SIGNING_SESSION.CANCELLED ou TRANSACTION.CANCELLED:
         UPDATE envelope_status SET status='CANCELLED', updated_at=now() ...
       SIGNING_SESSION.EXPIRED ou TRANSACTION.EXPIRED:
         UPDATE envelope_status SET status='EXPIRED', updated_at=now() ...
  f) Responder "ok" 200.

══════════════════════════════════════════════════
4) HOOK REACT: useSignDocs
══════════════════════════════════════════════════

Arquivo: src/hooks/useSignDocs.ts

Exporta useSignDocs() com função async startSigning(input) onde input é:
  { signerName, signerEmail, signerCpf?, pdfBase64, filename? }.

Ao ser chamado:
  const { data, error } = await supabase.functions.invoke(
    "create-signing-session",
    { body: { ...input, returnUrl: `${window.location.origin}/assinado` } }
  );
  if (error) throw error;
  window.location.href = data.signingUrl;

══════════════════════════════════════════════════
5) COMPONENTE: SigningStatus
══════════════════════════════════════════════════

Arquivo: src/components/SigningStatus.tsx

Props: { sessionId: string }.

No useEffect:
  - SELECT inicial: supabase.from("envelope_status").select("status")
    .eq("session_id", sessionId).single()
  - Inscrever em canal Realtime:
    supabase.channel(`envelope:${sessionId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "envelope_status",
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => setStatus(payload.new.status))
      .subscribe();
  - Cleanup: supabase.removeChannel(channel).

Renderiza um Badge (shadcn/ui):
  variant="default" se status === "COMPLETED", "secondary" caso contrário.

══════════════════════════════════════════════════
6) PÁGINA: Index (rota "/")
══════════════════════════════════════════════════

Arquivo: src/pages/Index.tsx

Mostra um Card (shadcn/ui) "Enviar contrato para assinatura" com:
  - Input file (accept=".pdf") — lê como base64 (FileReader.readAsDataURL,
    e remove o prefixo "data:application/pdf;base64,")
  - Input text: nome do signatário
  - Input email: email do signatário
  - Input text opcional: CPF (placeholder "000.000.000-00")
  - Button "Enviar para assinatura" — chama useSignDocs().startSigning com
    { signerName, signerEmail, signerCpf, pdfBase64, filename }.

Estado de loading enquanto upload+invoke. Toast de erro via sonner em falha.

Exige usuário logado (use supabase.auth). Se não logado, mostre tela de login
(email magic link via supabase.auth.signInWithOtp).

══════════════════════════════════════════════════
7) PÁGINA: Assinado (rota "/assinado")
══════════════════════════════════════════════════

Arquivo: src/pages/Assinado.tsx

Esta é a returnUrl após a assinatura. Mostra:
  - Título "Obrigado! Sua assinatura foi registrada."
  - Se a URL tem ?session_id=<id>, renderize <SigningStatus sessionId={id} />
    para mostrar o status em tempo real.
  - Quando status === "COMPLETED", mostre uma mensagem "Assinatura concluída"
    com ícone verde.
  - Botão "Voltar ao início" que navega para "/".

OBS: o Lovable deve atualizar o hook useSignDocs para incluir ?session_id
na returnUrl, para que a página Assinado saiba qual sessão observar.

══════════════════════════════════════════════════
8) ROTEAMENTO
══════════════════════════════════════════════════

Configure react-router-dom:
  "/"          → <Index />
  "/assinado"  → <Assinado />
  "*"          → <NotFound />

══════════════════════════════════════════════════
ESTILO
══════════════════════════════════════════════════

Use Tailwind + shadcn/ui. Layout limpo e centrado. Max-width 640px no Card da
Index. Tipografia Inter. Nada de gradientes berrantes — estilo corporativo.

══════════════════════════════════════════════════
⚠️ LEMBRETES DE NÃO-REGRESSÃO
══════════════════════════════════════════════════

1) create-signing-session deve montar signingUrl com "?cs=" + clientSecret.
2) create-signing-session NÃO usa --no-verify-jwt. signdocs-webhook USA.
3) SUPABASE_SERVICE_ROLE_KEY só aparece em supabase/functions/ — nunca em src/.
4) HMAC do webhook é sobre `${timestamp}.${body}` (com ponto literal),
   comparado com timingSafeEqual.
5) envelope_status deve estar na publicação supabase_realtime.
```

---

## Depois de rodar o prompt

1. Abra o painel Supabase → Edge Functions → confirme que **as duas funções** estão `Active`.
2. Abra Database → Tables → confirme que `envelope_status` tem RLS ligada.
3. Abra Database → Replication → `supabase_realtime` → confirme que `envelope_status` está marcada.
4. Pegue a URL pública da função `signdocs-webhook`: `https://<project-ref>.supabase.co/functions/v1/signdocs-webhook`.
5. No painel HML do SignDocs, registre o webhook com essa URL e os eventos: `SIGNING_SESSION.COMPLETED`, `SIGNING_SESSION.CANCELLED`, `SIGNING_SESSION.EXPIRED`, `TRANSACTION.COMPLETED`.
6. Copie o campo `secret` da resposta do registro e atualize `SIGNDOCS_WEBHOOK_SECRET` no Supabase. Redeploy a função webhook.
7. Teste no preview do Lovable com um PDF de teste.

## Se algo falhar

Veja a [tabela de troubleshooting no guia técnico](https://github.com/signdocsbrasil/external-api/blob/main/docs/lovable-integration-guide.md#9-troubleshooting-estilo-pergunte-ao-lovable) — tem prompts prontos de correção para os problemas mais comuns (401 no signingUrl, webhook sempre 401, status travado em PENDING, Realtime sem atualizar, etc).
