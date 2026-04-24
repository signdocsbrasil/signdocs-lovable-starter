# Lovable Mega-Prompt — SignDocs Brasil

Um único prompt para colar no chat de um projeto **Lovable em branco**. Gera a integração SignDocs Brasil completa: tabela Postgres, três Edge Functions, componentes React e rotas.

**Antes de colar:** adicione os 4 secrets no painel Supabase → Edge Functions → Secrets:

```
SIGNDOCS_CLIENT_ID       = <gerado em app.signdocs.com.br (self-service)>
SIGNDOCS_CLIENT_SECRET   = <gerado em app.signdocs.com.br (self-service)>
SIGNDOCS_BASE_URL        = https://api-hml.signdocs.com.br
SIGNDOCS_WEBHOOK_SECRET  = pending (placeholder; preenchido na etapa final)
```

> ⚠️ HML usa **hífen** (`api-hml`). Com ponto (`api.hml`) dá timeout silencioso — é o erro nº 1.

---

## 👇 Copie tudo abaixo e cole no chat do Lovable

```
Vou adicionar assinatura digital com validade jurídica brasileira (SignDocs Brasil) a este SaaS. A stack é React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (padrão do Lovable).

Gere TODOS os artefatos abaixo em uma única implementação. Respeite os pontos críticos marcados com ⚠️ — eles causam falhas silenciosas se errados. Estes pontos foram descobertos em testes end-to-end reais; NÃO os modifique para "melhorar" a estrutura.

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
  { signerName, signerEmail, signerCpf, pdfBase64, filename?, returnUrl }

  ⚠️ signerCpf É OBRIGATÓRIO. O SignDocs exige CPF para criar sessão.
     Se vier vazio, a edge function deve responder 400 com mensagem clara.

Fluxo:
  a) Se req.method !== "POST", responder 405.
  b) Extrair Bearer do header Authorization. Chamar
     supabase.auth.getUser(token). Se inválido, 401.
  c) Validar que signerCpf está presente e tem 11 dígitos (ignorando máscara).
     Se não, responder 400: { error: "CPF é obrigatório e deve ter 11 dígitos" }.
  d) Chamar signdocs.signingSessions.create({
       purpose: "DOCUMENT_SIGNATURE",
       policy:  { profile: "CLICK_ONLY" },
       signer:  { name: signerName, email: signerEmail, cpf: signerCpf,
                  userExternalId: userData.user.id },
       document:{ content: pdfBase64, filename: filename ?? "contrato.pdf" },
       returnUrl,  ⚠️ VER NOTA ABAIXO
       locale:  "pt-BR",
     })
  e) ⚠️ CRÍTICO #1 — Montar signingUrl = session.url + "?cs=" +
     encodeURIComponent(session.clientSecret). Sem o ?cs a página retorna 401.
  f) Upsert em envelope_status usando session.sessionId (NÃO session.id — esse
     campo não existe no SDK e vem como null):
       session_id:     session.sessionId    ⚠️ CRÍTICO #2
       transaction_id: session.transactionId
       user_id:        userData.user.id
       status:         "PENDING"
  g) Responder JSON { sessionId: session.sessionId, signingUrl, expiresAt: session.expiresAt }.

⚠️ CRÍTICO #3 — returnUrl: passe EXATAMENTE `${window.location.origin}/assinado`
   (vindo do frontend), SEM adicionar query params nem placeholders tipo
   "__SESSION_ID__". O SignDocs anexa automaticamente ?session_id=ss_... no
   redirect de sucesso. Qualquer manipulação manual aqui vai duplicar ou
   corromper o param.

══════════════════════════════════════════════════
3) EDGE FUNCTION: signdocs-webhook
══════════════════════════════════════════════════

Arquivo: supabase/functions/signdocs-webhook/index.ts

Runtime: Deno. ⚠️ Deploy COM --no-verify-jwt (webhooks não trazem JWT do Supabase).
Configure isso em supabase/config.toml por função.

⚠️ CRÍTICO #4 — Deno NÃO tem Buffer global. Use TextEncoder ou um helper
hexToBytes() para converter strings hex para Uint8Array antes de passar
ao timingSafeEqual. NUNCA use Buffer.from() — crasha com ReferenceError
em runtime e você perde todos os webhooks.

Imports:
  import { createClient } from "npm:@supabase/supabase-js@2";
  import { createHmac, timingSafeEqual } from "node:crypto";

Secrets: SIGNDOCS_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Helper obrigatório (no topo do arquivo):
  function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

Fluxo:
  a) Se req.method !== "POST", responder 405.
  b) Ler headers x-signdocs-signature (sig) e x-signdocs-timestamp (ts).
  c) ⚠️ Validar janela anti-replay — se |now - ts| > 300s, 401.
  d) Computar HMAC-SHA256 sobre a string literal `${ts}.${body}` (com ponto)
     usando SIGNDOCS_WEBHOOK_SECRET. Converter sig e expected para Uint8Array
     via hexToBytes() e comparar com timingSafeEqual. Se divergir, 401.
  e) Logar o payload recebido (com fields eventType, transactionId,
     data.sessionId, dataTransactionId) e o número de linhas afetadas pelo
     UPDATE — fundamental para debug.
  f) Parsear body JSON. Sobre event.eventType (SignDocs emite prefixo
     TRANSACTION.*; inclua SIGNING_SESSION.* por compatibilidade futura):
       TRANSACTION.COMPLETED ou SIGNING_SESSION.COMPLETED:
         UPDATE envelope_status SET status='COMPLETED',
                                     evidence_id=event.data?.evidenceId,
                                     updated_at=now()
           WHERE transaction_id = event.transactionId
              OR session_id     = event.data?.sessionId
       TRANSACTION.CANCELLED: UPDATE ... status='CANCELLED' ...
       TRANSACTION.EXPIRED:   UPDATE ... status='EXPIRED' ...
       TRANSACTION.FAILED:    UPDATE ... status='FAILED' ... (adicione 'FAILED' ao enum de status visualizado no frontend)
  g) Responder "ok" 200.

══════════════════════════════════════════════════
4) EDGE FUNCTION: get-signing-status (para polling)
══════════════════════════════════════════════════

Arquivo: supabase/functions/get-signing-status/index.ts

Runtime: Deno. Deploy COM --no-verify-jwt (é pública, consulta somente por session_id
que não é adivinhável).

Entrada: POST JSON { sessionId: string }

Fluxo:
  a) Se req.method !== "POST", responder 405.
  b) Validar que sessionId começa com "ss_".
  c) SELECT status, evidence_id, updated_at FROM envelope_status
     WHERE session_id = sessionId LIMIT 1.
  d) Retornar { status, evidenceId, updatedAt }. Se não achar, { status: "NOT_FOUND" }.

Por que existe: fallback de polling caso o canal Realtime não propague
(acontece quando o usuário redireciona de volta do SignDocs e o webhook já
disparou antes do canal subscribe). Polling leve a cada 3s garante que
/assinado sempre converge, sem depender só de Realtime.

══════════════════════════════════════════════════
5) HOOK REACT: useSignDocs
══════════════════════════════════════════════════

Arquivo: src/hooks/useSignDocs.ts

Exporta useSignDocs() com função async startSigning(input) onde input é:
  { signerName, signerEmail, signerCpf, pdfBase64, filename? }.

⚠️ signerCpf é obrigatório. Valide (11 dígitos, ignorando máscara) antes de
invocar a função.

Ao ser chamado:
  const { data, error } = await supabase.functions.invoke(
    "create-signing-session",
    {
      body: {
        ...input,
        // ⚠️ returnUrl LIMPO — sem placeholders. SignDocs adiciona ?session_id= no redirect.
        returnUrl: `${window.location.origin}/assinado`,
      },
    },
  );
  if (error) throw error;
  window.location.href = data.signingUrl;

══════════════════════════════════════════════════
6) COMPONENTE: SigningStatus (3 camadas de atualização)
══════════════════════════════════════════════════

Arquivo: src/components/SigningStatus.tsx

Props: { sessionId: string }.

⚠️ Arquitetura de 3 camadas para garantir que o status sempre converge:
  1. Realtime (caminho feliz)
  2. Refetch no evento SUBSCRIBED (caso o UPDATE aconteça antes do subscribe)
  3. Polling a cada 3s via get-signing-status (fallback total)

Estados: "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "FAILED"

useEffect:
  1) Fetch inicial via get-signing-status (bypassa RLS, pega status imediato)
  2) Inscrever em canal Realtime:
     supabase.channel(`envelope:${sessionId}`)
       .on("postgres_changes", {
         event: "UPDATE", schema: "public", table: "envelope_status",
         filter: `session_id=eq.${sessionId}`,
       }, (payload) => setStatus(payload.new.status))
       .subscribe((status) => {
         if (status === "SUBSCRIBED") {
           // refetch no momento da subscrição: pega update que aconteceu antes
           refetchViaGetSigningStatus();
         }
       });
  3) Interval polling (só enquanto status ainda é PENDING):
     const poll = setInterval(() => {
       if (currentStatus === "PENDING") refetchViaGetSigningStatus();
     }, 3000);

Cleanup: supabase.removeChannel(channel) + clearInterval(poll).

Renderiza um Badge (shadcn/ui):
  variant="default" se status === "COMPLETED", "secondary" caso contrário.
  Textos: "Aguardando assinatura" | "Assinado" | "Cancelado" | "Expirado" | "Falhou"

══════════════════════════════════════════════════
7) PÁGINA: Index (rota "/")
══════════════════════════════════════════════════

Arquivo: src/pages/Index.tsx

Se NÃO estiver logado, mostre tela de magic link (supabase.auth.signInWithOtp).

Se logado, mostra um Card (shadcn/ui) "Enviar contrato para assinatura" com:
  - Input file (accept=".pdf") — lê como base64 (FileReader.readAsDataURL,
    e remove o prefixo "data:application/pdf;base64,")
  - Input text: nome do signatário (required)
  - Input email: email do signatário (required)
  - Input text: CPF — ⚠️ OBRIGATÓRIO, label com asterisco (*), máscara
    000.000.000-00 enquanto digita, placeholder "111.444.777-35",
    validação client-side (11 dígitos, ignorando máscara)
  - Button "Enviar para assinatura" — chama useSignDocs().startSigning.

Estado de loading enquanto upload+invoke. Toast de erro via sonner em falha
(inclui toast específico se CPF estiver inválido: "CPF é obrigatório").

══════════════════════════════════════════════════
8) PÁGINA: Assinado (rota "/assinado")
══════════════════════════════════════════════════

Arquivo: src/pages/Assinado.tsx

Lê session_id da query string (SignDocs adiciona automaticamente no redirect).

Mostra:
  - Título "Obrigado! Sua assinatura foi registrada."
  - Subtítulo: "Acompanhe abaixo o status do seu envelope em tempo real."
  - Card com "Sessão <session_id>" e o componente <SigningStatus sessionId={id} />
  - Quando status === "COMPLETED", mostre uma seção de sucesso com ícone
    verde e texto "Assinatura concluída com validade jurídica."
  - Botão "Voltar ao início" que navega para "/".

══════════════════════════════════════════════════
9) ROTEAMENTO
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
⚠️ LEMBRETES DE NÃO-REGRESSÃO (DESCOBERTOS EM TESTE REAL)
══════════════════════════════════════════════════

1) create-signing-session monta signingUrl com "?cs=" + clientSecret.
2) create-signing-session NÃO usa --no-verify-jwt. signdocs-webhook e
   get-signing-status USAM.
3) SUPABASE_SERVICE_ROLE_KEY só aparece em supabase/functions/ — nunca em src/.
4) HMAC do webhook é sobre `${timestamp}.${body}` (com ponto literal).
5) ⚠️ Deno NÃO tem Buffer global — use hexToBytes() + timingSafeEqual.
6) ⚠️ Upsert usa session.sessionId (não session.id — esse vem null).
7) ⚠️ returnUrl vai LIMPO ("/assinado"), sem placeholders. SignDocs adiciona
   ?session_id automaticamente.
8) ⚠️ CPF é obrigatório (não opcional) — SignDocs rejeita sessões sem CPF.
9) envelope_status deve estar na publicação supabase_realtime.
10) SigningStatus precisa das 3 camadas (Realtime + refetch-on-SUBSCRIBED +
    polling de 3s) — sem polling, /assinado pode ficar preso em PENDING quando
    o UPDATE acontece antes do subscribe.
```

---

## Depois de rodar o prompt

1. Abra o painel Supabase → Edge Functions → confirme que **as três funções** estão `Active`.
2. Abra Database → Tables → confirme que `envelope_status` tem RLS ligada.
3. Abra Database → Replication → `supabase_realtime` → confirme que `envelope_status` está marcada.
4. Pegue a URL pública da função `signdocs-webhook`: `https://<project-ref>.supabase.co/functions/v1/signdocs-webhook`.
5. No painel HML do SignDocs, registre o webhook com essa URL e os eventos: `TRANSACTION.COMPLETED`, `TRANSACTION.CANCELLED`, `TRANSACTION.EXPIRED`, `TRANSACTION.FAILED` (os eventos começam com `TRANSACTION.*`, não `SIGNING_SESSION.*`).
6. Copie o campo `secret` da resposta do registro (mostrado uma única vez) e atualize `SIGNDOCS_WEBHOOK_SECRET` no Supabase via painel (não pelo chat do Lovable, por segurança). Redeploy a função webhook se necessário.
7. Teste no preview do Lovable com um PDF de teste, seu próprio email como signatário, e um CPF válido (ex: `111.444.777-35`).

## Se algo falhar

Veja a [tabela de troubleshooting no guia técnico](https://docs.signdocs.com.br/guias/lovable-integracao.html#9-troubleshooting) — tem prompts prontos de correção para os problemas mais comuns (401 no signingUrl, webhook sempre 401, status travado em PENDING, Realtime sem atualizar, `Buffer is not defined` no Deno, etc).

## Histórico de correções (learnings de teste real — 2026-04-23)

Este mega-prompt foi atualizado após um teste end-to-end em HML que revelou 4 bugs silenciosos na versão anterior:

1. **`session.id` é null** — usar sempre `session.sessionId`
2. **`Buffer` não é global no Deno** — usar `hexToBytes()` + `timingSafeEqual`
3. **`returnUrl` com placeholder corrompe query string** — passar limpo, SignDocs adiciona
4. **Realtime pode perder UPDATE quando a navegação acontece antes do subscribe** — precisa polling

Os 4 estão corrigidos acima. Se encontrar um bug novo em um teste real, adicione-o ao histórico e atualize a seção de não-regressão.
