# Lovable Mega-Prompt — SignDocs Brasil

Um único prompt para gerar a integração SignDocs Brasil completa em um projeto **Lovable em branco**: tabela Postgres, três Edge Functions, componentes React e rotas.

> **Para projeto Lovable já existente?** Este mega-prompt assume um projeto em branco. Se você já tem código, auth, rotas e componentes em produção, **cole o [preamble de projeto existente](https://github.com/signdocsbrasil/signdocs-lovable-starter/blob/main/prompts/existing-project-preamble.md) ANTES** do mega-prompt para evitar que o Lovable sobrescreva sua autenticação ou rotas.

---

## Sequência de setup (siga em ordem — não pule passos)

### 1. Crie um projeto Lovable em branco (não cole o mega-prompt aqui!)

Na home do Lovable (`lovable.dev/dashboard`), o input "Ask Lovable to build a landing page for my..." vira o **seed do projeto inteiro**. Se você colar o mega-prompt aqui, o Lovable tenta gerar tudo antes de Supabase estar conectado e quebra. **Cole apenas uma descrição curta como seed**, exemplo:

```
Template de app de assinatura digital integrado ao SignDocs Brasil.
Stack: React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase.
Idioma pt-BR. Vou adicionar a integração completa em um próximo prompt —
por enquanto, gere só o esqueleto: uma landing simples.
```

Após o esqueleto carregar, você cai dentro do editor do projeto. **É lá** que o mega-prompt vai.

### 2. Quando o Lovable oferecer "Enable Cloud", clique **Allow** ✅

Mid-fluxo o Lovable vai pedir para habilitar **Lovable Cloud** — sua oferta de Supabase gerenciado. **Aceite.**

| Caminho | Vantagens | Desvantagens |
|---|---|---|
| **Lovable Cloud (recomendado)** | Aplica migrations e deploya Edge Functions automaticamente. O cliente `@/integrations/supabase/client` é auto-gerado. Build verde imediato. | Cria um Supabase **novo** sob gerência do Lovable. Região default = "Americas" (latência ~150ms para BR vs ~30ms em São Paulo). **Não pode ser desativado depois** — é one-way. |
| External Supabase via Connectors | Você controla o projeto Supabase (região São Paulo, dashboard direto). | Lovable gera o código mas **não aplica migrations nem deploya Edge Functions** automaticamente. Você precisa fazer manualmente via SQL Editor + CLI. Friction alta para remixers. |

Para um template remixável: **Cloud é a escolha certa**. A latência adicional é desprezível para volume de demo, e a UX de "1-clique → funciona" vale mais do que economia de 100ms.

> ⚠️ **Cloud é one-way**: depois de habilitar, não dá para desabilitar nesse mesmo projeto. Se mudar de ideia, abandone o projeto Lovable e comece outro.

> 📝 **Connectors movidos**: a partir de 2026, o Supabase Connector (a alternativa ao Cloud) saiu do toolbar do projeto e foi para o sidebar do dashboard (`Connectors` na barra lateral). O ícone de raio que ficava no editor do projeto agora é só upgrade/billing — não Supabase.

### 3. Gere credenciais HML em [app.signdocs.com.br](https://app.signdocs.com.br) (self-service via wizard de plano)

**Pré-condições obrigatórias:**
- Conta deve ser **Pessoa Jurídica (com CNPJ)** — Pessoa Física não tem acesso ao plano Enterprise nem à API.
- Web ou Android — usuários iOS não veem a opção Enterprise por restrição da App Store.

**Fluxo passo a passo (~3 min):**

1. Crie conta grátis em [app.signdocs.com.br](https://app.signdocs.com.br). No cadastro, marque **Pessoa Jurídica** e preencha CNPJ.
2. No dashboard, abra o menu de **Perfil** (avatar) → **Gerenciar Plano**.
3. O wizard de plano abre. Responda nesta sequência para chegar ao Enterprise:
   - "Quer o plano grátis (≤5 docs/mês)?" → **Não**
   - "Precisa de mais de 4 usuários?" → **Sim**
   - "Precisa de mais de 80 docs/mês?" → **Sim**
   - "Precisa de mais de 200 docs/mês?" → **Sim**
4. Você cai no card **"Plano Enterprise — Orçamento personalizado"**. No campo "Descreva suas necessidades", explique o caso de uso. Exemplo:
   > *"Integração SignDocs Brasil em SaaS no Lovable com Supabase Edge Functions. Quero credenciais HML para integrar e testar antes de migrar para produção."*
5. Clique **Receber Orçamento**. O backend dispara um email para o time SignDocs E **flagueia sua conta como Enterprise imediatamente** (sem espera, sem revisão manual). O email é só para acompanhamento de vendas.
6. Volte para o **Perfil**. Agora aparece o botão **Abrir API Dashboard** (visível só para Enterprise). Clique.
7. Na tela "Ativar credenciais HML", preencha:
   - **Nome da empresa** (obrigatório)
   - **CNPJ** (opcional mas recomendado para integrar com nota fiscal/cobrança no futuro)
   - Marque o checkbox **"Concordo com os termos de uso da API sandbox SignDocs"**
8. Clique **Ativar credenciais HML**.
9. Um modal abre **UMA ÚNICA VEZ** com:
   - `tenantId`
   - `clientId`
   - `clientSecret` ⚠️ não mostrado de novo
   - Sandbox endpoint URL
   - Docs URL

   **Copie todos os 4 imediatamente** para um gerenciador de senhas. Se perder o `clientSecret`, é necessário reprovisionar (rotaciona o secret; `clientId` continua o mesmo, mas o secret antigo invalida).

> 💡 Se sua demanda real é de testes (não 200 docs/mês de fato), seja honesto na descrição — o time SignDocs não vai cobrar você por algo que não está usando. A flag Enterprise é apenas para destravar o acesso à API; cutover comercial para produção é conversado depois.

### 4. Adicione 4 secrets no painel Supabase do Cloud

Lovable Cloud abre o painel Supabase do projeto que ele provisionou. Vá em **Edge Functions → Secrets**:

```
SIGNDOCS_CLIENT_ID       = <gerado no passo 3>
SIGNDOCS_CLIENT_SECRET   = <gerado no passo 3>
SIGNDOCS_BASE_URL        = https://api-hml.signdocs.com.br
SIGNDOCS_WEBHOOK_SECRET  = pending (placeholder; preenchido depois)
```

> ⚠️ HML usa **hífen** (`api-hml`). Com ponto (`api.hml`) dá timeout silencioso — é o erro nº 1.

### 5. Cole o mega-prompt no chat do Lovable

Agora sim — dentro do editor do projeto, no chat "Ask Lovable...", cole o bloco entre triple-backticks abaixo. Ignore os "suggestion chips" que aparecem (ex: "Configurar SEO", "Adicionar formulário de contato", "Criar tela de onboarding") — são up-sells; nosso fluxo não precisa.

> 💰 **Orçamento de créditos**: o caminho feliz consome ~5–8 créditos (mega-prompt geração + Cloud setup + secrets). Free tier dá 5/dia + ~5 bonus iniciais = ~10 — suficiente para uma sessão se nada falhar. Pro ($5/mês) dá 20 e roll-over. Em abril de 2026, há promo "2x credits until Apr 30".

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

### Configuração final

1. Abra o painel Supabase → Edge Functions → confirme que **as três funções** estão `Active`.
2. Abra Database → Tables → confirme que `envelope_status` tem RLS ligada.
3. Abra Database → Replication → `supabase_realtime` → confirme que `envelope_status` está marcada.
4. Pegue a URL pública da função `signdocs-webhook`: `https://<project-ref>.supabase.co/functions/v1/signdocs-webhook`.
5. No painel HML do SignDocs (`app.signdocs.com.br` → Webhooks → Novo), registre o webhook com essa URL e selecione os eventos:
   - `TRANSACTION.COMPLETED`
   - `TRANSACTION.CANCELLED`
   - `TRANSACTION.EXPIRED`
   - `TRANSACTION.FAILED`

   ⚠️ Os eventos começam com `TRANSACTION.*` no painel — não existem `SIGNING_SESSION.*` na API HML.
6. **Copie o `secret` retornado IMEDIATAMENTE** — aparece uma única vez. Cole **direto no painel Supabase** (Edge Functions → Secrets → editar `SIGNDOCS_WEBHOOK_SECRET`). **Não cole via chat do Lovable nem em qualquer outro AI assistant** — o secret fica no histórico e vira vetor de ataque. Se você acidentalmente passar o secret por chat, **rotacione**: delete o webhook em SignDocs HML, registre de novo, atualize com o novo secret pelo painel Supabase.
7. Teste no preview do Lovable com um PDF de teste (até ~10MB; PDFs maiores podem hit timeout do Edge Function), seu próprio email como signatário, e um CPF válido (ex: `111.444.777-35`).

### Comportamentos esperados pós-assinatura

- **SignDocs envia automaticamente** um email de confirmação ao signatário a partir de `no-reply@mg.signdocs.com.br`. Não precisa construir esse fluxo no app.
- O webhook entrega `event.data.evidenceId` no payload de TRANSACTION.COMPLETED — esse é o ID do **evidence pack `.p7m`** (pacote criptográfico assinado contendo hash do documento, geolocalização, IP, timestamp, método de autenticação). Pode baixar depois via `GET /v1/evidence/{evidenceId}/download` (autenticado). Para um SaaS de produção, salve o `evidence_id` e exponha um botão "Baixar evidência" para o signatário.
- A linha em `envelope_status` fica:
  ```json
  {
    "session_id":     "ss_01k...",
    "transaction_id": "tx_01k...",
    "status":         "COMPLETED",
    "evidence_id":    "ev_01k...",
    "updated_at":     "2026-04-24T00:43:08+00:00"
  }
  ```

### ⚠️ HML é efêmero

Todos os documentos, sessões, evidências e logs em HML são apagados em até **7 dias** automaticamente. **Nunca use PDFs reais, CPFs reais ou emails de clientes em HML** — vão sumir e não há recuperação. Para produção, troque `SIGNDOCS_BASE_URL` para `https://api.signdocs.com.br` e use credenciais de produção (geradas no mesmo dashboard self-service). Sem mudança de código.

### Payload real do webhook (para referência)

A `TRANSACTION.COMPLETED` que SignDocs envia tem essa forma:

```json
{
  "eventType":         "TRANSACTION.COMPLETED",
  "transactionId":     "tx_01kpyf0ahs9jt2mekrwdkv2zha",
  "dataTransactionId": "tx_01kpyf0ahs9jt2mekrwdkv2zha",
  "data": {
    "evidenceId": "ev_01kpyf0tqph23knc1vckqfxjmf",
    "sessionId":  null
  }
}
```

Note que `data.sessionId` frequentemente vem `null` — por isso o webhook faz UPDATE com OR (`transaction_id = event.transactionId OR session_id = event.data.sessionId`). Se você só fizer match por `session_id`, vai atualizar zero linhas.

## Se algo falhar

Veja a [tabela de troubleshooting no guia técnico](https://docs.signdocs.com.br/guias/lovable-integracao.html#9-troubleshooting) — tem prompts prontos de correção para os problemas mais comuns (401 no signingUrl, webhook sempre 401, status travado em PENDING, Realtime sem atualizar, `Buffer is not defined` no Deno, dois `session_id` na URL, NOT NULL violation no upsert, etc).

## Histórico de correções (learnings de teste real — 2026-04-23)

Este mega-prompt foi atualizado após um teste end-to-end em HML que revelou 4 bugs silenciosos na versão anterior:

1. **`session.id` é null** — usar sempre `session.sessionId`
2. **`Buffer` não é global no Deno** — usar `hexToBytes()` + `timingSafeEqual`
3. **`returnUrl` com placeholder corrompe query string** — passar limpo, SignDocs adiciona
4. **Realtime pode perder UPDATE quando a navegação acontece antes do subscribe** — precisa polling

Os 4 estão corrigidos acima. Se encontrar um bug novo em um teste real, adicione-o ao histórico e atualize a seção de não-regressão.
