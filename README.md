# SignDocs Brasil — Lovable Starter

A partida remixável para adicionar assinatura eletrônica com validade jurídica brasileira (MP 2.200-2, ICP-Brasil, LGPD) em um SaaS construído no **Lovable**.

Integra com o SignDocs Brasil via **Supabase Edge Functions** (padrão nativo do Lovable). O `client_secret` nunca toca o browser.

---

## 🎬 Demo ao vivo

**[sign-docs-brasil.lovable.app](https://sign-docs-brasil.lovable.app)**

Veja o template funcionando — fluxo completo de assinatura digital com validade jurídica brasileira em ambiente HML. PDFs descartáveis, dados fictícios (CPF de teste: `111.444.777-35`), zero compromisso.

> ⚠️ Demo em HML — todos os documentos, assinaturas e dados são apagados em até 7 dias por design. Não envie contratos reais.

---

## Três caminhos para usar

### 🍴 Caminho 1 — Remix do template Lovable (mais rápido, ~5 min)

Visite o [demo ao vivo](https://sign-docs-brasil.lovable.app) e clique no badge **"Made with Lovable"** no rodapé do app. Lovable abre o projeto e oferece um botão para você remixar no seu próprio account — você ganha um clone funcional, só precisa adicionar suas próprias credenciais HML.

**Após remixar:**
1. [Gere credenciais HML](https://docs.signdocs.com.br/guias/lovable-integracao.html#0-pre-requisitos) self-service em `app.signdocs.com.br`
2. No Supabase do seu Lovable Cloud, adicione os 4 secrets `SIGNDOCS_*`
3. Registre o webhook em SignDocs HML, atualize `SIGNDOCS_WEBHOOK_SECRET`
4. Teste no preview do Lovable — pronto

### 🚀 Caminho 2 — Mega-prompt em projeto Lovable em branco (~10 min)

Para começar do zero (não remixar). Cole um único prompt no chat de um projeto Lovable em branco e ele gera a tabela, três Edge Functions, componentes React e rotas de uma vez.

👉 [`prompts/lovable-mega-prompt.md`](prompts/lovable-mega-prompt.md)

**Pré-requisito:** habilitar Lovable Cloud quando solicitado, gerar credenciais HML self-service, adicionar 4 secrets no painel Supabase. [Guia completo no docs portal](https://docs.signdocs.com.br/guias/lovable-integracao.html).

### 🧱 Caminho 3 — Prompts sequenciais para projeto existente (~20 min)

Se você já tem um SaaS Lovable em produção e quer adicionar assinatura sem reescrever, cole o [preamble de projeto existente](prompts/existing-project-preamble.md) primeiro e depois aplique os 5 prompts em ordem. Ideal também para entender cada parte da integração.

👉 [Guia completo com os 5 prompts](https://docs.signdocs.com.br/guias/lovable-integracao.html)

---

## Código-fonte de referência

Este repositório contém o código exato que o demo está rodando — está em [`reference/`](reference/). Pode usar para:

- Conferir o que o Lovable gerou após rodar os prompts (compare contra o código de referência)
- Adaptar para outros stacks (Vercel, Cloudflare Workers, etc.) que aceitam Edge Functions Deno-compatíveis
- Estudar offline antes de começar a remixar

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
