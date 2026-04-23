# SignDocs Brasil — Lovable Starter

A partida remixável para adicionar assinatura eletrônica com validade jurídica brasileira (MP 2.200-2, ICP-Brasil, LGPD) em um SaaS construído no **Lovable**.

Integra com o SignDocs Brasil via **Supabase Edge Functions** (padrão nativo do Lovable). O `client_secret` nunca toca o browser.

---

## Três caminhos para usar

### 🚀 Caminho 1 — Mega-prompt (mais rápido, ~10 min)

Cole um único prompt no chat de um projeto Lovable em branco. Ele gera a tabela, as duas Edge Functions, os componentes React e as rotas de uma vez.

👉 [`prompts/lovable-mega-prompt.md`](prompts/lovable-mega-prompt.md)

**Pré-requisito:** adicione os 4 secrets do SignDocs no painel Supabase antes de rodar o prompt (veja [`.env.example`](.env.example)).

### 🧱 Caminho 2 — Prompts sequenciais (passo-a-passo, ~20 min)

Se você quer ir construindo por partes e entendendo cada uma, cole os 5 prompts em ordem. Ideal para aprender a integração.

👉 [Guia completo com os 5 prompts](https://github.com/signdocsbrasil/external-api/blob/main/docs/lovable-integration-guide.md)

### 🍴 Caminho 3 — Remix direto (para times SignDocs e parceiros)

Publicaremos uma versão deste starter como projeto Lovable remixável. Quando disponível, o link será incluído aqui e na [página de integração Lovable](https://www.signdocs.com.br/integracao-lovable-assinatura-digital.html).

Enquanto isso, este repositório serve como referência canônica — o código em `reference/` é exatamente o que os prompts geram.

---

## O que o starter entrega

Um app Lovable mínimo que demonstra o fluxo completo:

1. **Página inicial** (`/`) — upload de PDF + formulário de signatário + botão "Enviar para assinatura"
2. **Página de retorno** (`/assinado`) — landing pós-assinatura com badge de status atualizado em tempo real via Supabase Realtime
3. **Tabela `envelope_status`** — espelho local do status da sessão, com RLS
4. **Edge Function `create-signing-session`** — proxy server-side que fala com o SignDocs, monta o `signingUrl` correto e persiste o status inicial
5. **Edge Function `signdocs-webhook`** — recebe eventos do SignDocs, valida HMAC-SHA256 com janela anti-replay e atualiza `envelope_status`

Nenhum polling. O badge da UI muda porque o webhook escreveu no banco — não porque o frontend bateu na API.

---

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui (stack padrão do Lovable)
- **Backend:** Supabase (Postgres + Edge Functions Deno + Realtime + Auth)
- **Integração:** [`@signdocs-brasil/api`](https://www.npmjs.com/package/@signdocs-brasil/api) v1.3.0+ (SDK TypeScript oficial)

---

## Pré-requisitos

| O que | Como obter |
|---|---|
| Conta Lovable | [lovable.dev](https://lovable.dev) |
| Projeto Supabase conectado | Lovable → ícone Supabase no topo → *Connect* |
| Credenciais SignDocs HML | Solicite em [signdocs.com.br/integracao-lovable-assinatura-digital.html](https://www.signdocs.com.br/integracao-lovable-assinatura-digital.html) |

Copie [`.env.example`](.env.example) para referência sobre quais secrets criar no Supabase.

---

## Referência canônica

O diretório [`reference/`](reference/) contém o código exato que os prompts geram. Use para:

- Verificar se a geração do Lovable saiu correta (os 3 pontos críticos: `?cs=` no `signingUrl`, deploy sem `--no-verify-jwt` na função de criação, HMAC com timing-safe no webhook)
- Copiar manualmente se preferir não depender da geração AI
- Adaptar para outros backends (Vercel, Cloudflare Workers, AWS Lambda) — o padrão server-side é o mesmo

**Árvore de referência:**

```
reference/
├── supabase/
│   ├── migrations/
│   │   └── 0001_envelope_status.sql
│   └── functions/
│       ├── create-signing-session/index.ts
│       └── signdocs-webhook/index.ts
└── src/
    ├── hooks/useSignDocs.ts
    ├── components/
    │   ├── SignButton.tsx
    │   └── SigningStatus.tsx
    └── pages/
        ├── Index.tsx
        └── Assinado.tsx
```

---

## Testar em HML

1. No preview do Lovable, suba um PDF de teste (qualquer contrato, sem valor real)
2. Use seu próprio email como signatário
3. Clique "Enviar para assinatura" — você é redirecionado para `sign-hml.signdocs.com.br`
4. Complete a assinatura (perfil `CLICK_ONLY` — só confirmação)
5. Volta para `/assinado` — o badge deve virar `COMPLETED` em menos de 2 segundos

**Prova de que não há polling:** desregistre o webhook no painel HML e refaça o fluxo. O status deve ficar em `PENDING`. Se virar `COMPLETED` sem webhook, há regressão.

---

## Cutover para produção

O código não muda — só 3 secrets:

```
SIGNDOCS_BASE_URL        https://api.signdocs.com.br   (sem -hml)
SIGNDOCS_CLIENT_ID       <credenciais prod>
SIGNDOCS_CLIENT_SECRET   <credenciais prod>
SIGNDOCS_WEBHOOK_SECRET  <novo secret, do webhook prod>
```

Re-registre o webhook no tenant prod (nova URL, novo secret). Smoke-test antes de liberar para todos os usuários.

---

## Suporte

- Guia técnico completo: [external-api/docs/lovable-integration-guide.md](https://github.com/signdocsbrasil/external-api/blob/main/docs/lovable-integration-guide.md)
- Página de integração: [signdocs.com.br/integracao-lovable-assinatura-digital.html](https://www.signdocs.com.br/integracao-lovable-assinatura-digital.html)
- Tickets: `suporte@signdocs.com.br` (inclua `client_id`, nunca `client_secret`)

---

## Licença

MIT. Sinta-se livre para copiar, adaptar e redistribuir — inclusive como template comercial.
