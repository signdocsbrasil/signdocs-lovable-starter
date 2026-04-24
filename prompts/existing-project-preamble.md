# Existing-Project Preamble

Cole este bloco no chat do Lovable **ANTES** do mega-prompt principal quando o seu projeto Lovable **já está em produção** com auth, rotas e componentes próprios. Sem este preamble, o Lovable pode sobrescrever sua autenticação, rotas ou componentes durante a geração.

---

## 👇 Cole este bloco como PRIMEIRA mensagem no chat

```
IMPORTANTE — este é um projeto Lovable EXISTENTE com código, auth,
rotas e componentes em produção. Ao aplicar a integração SignDocs
Brasil do mega-prompt a seguir, siga estas regras:

1. NÃO altere o sistema de autenticação existente. Se o projeto já tem
   auth (email/senha, OAuth, magic-link etc.), mantenha. O useSignDocs
   precisa apenas de um usuário autenticado via supabase.auth — adapte
   a chamada supabase.auth.getUser() ao auth atual, se necessário.

2. NÃO sobrescreva rotas existentes. Se /assinado já existe com outra
   finalidade, use /contrato-assinado (ou outro slug livre) e ajuste
   o returnUrl no hook useSignDocs.

3. NÃO modifique componentes, páginas ou hooks existentes além dos
   que o mega-prompt cria. Se um arquivo com nome pedido já existe,
   pare e pergunte antes de sobrescrever.

4. NÃO adicione o SignButton automaticamente em nenhuma página
   existente — crie apenas o componente em src/components/SignButton.tsx
   como export nomeado, com um comentário explicando onde o dono do
   projeto deve importar. Ele decide onde o botão fica.

5. Respeite o estilo visual atual (tema, cores, tipografia, fontes).
   Não introduza bibliotecas de UI além das já usadas.

6. Supabase deve estar conectado ao projeto. Se ainda não está, pause
   e me avise antes de gerar qualquer Edge Function — vamos habilitar
   Lovable Cloud primeiro (recomendado) ou conectar Supabase externo
   via Connectors.

Aplique agora o mega-prompt SignDocs Brasil abaixo (cole como segunda
mensagem no chat):
```

---

## Depois cole o mega-prompt principal

[`prompts/lovable-mega-prompt.md`](./lovable-mega-prompt.md) — copie o bloco entre triple-backticks.

## Considerações para projetos existentes

- **Auth diferente de magic-link?** Se você usa email/senha ou OAuth, o `useSignDocs` ainda funciona — só precisa que `supabase.auth.getUser()` retorne um user válido. O `userExternalId` da SignDocs vai apontar para o `id` do user do Supabase, isolando assinaturas por usuário via RLS.

- **Já tem uma tabela `envelope_status` ou similar?** Renomeie a nova tabela do mega-prompt (ex: `signdocs_envelope_status`) e atualize o `from()` em todas as queries.

- **Webhook URL pública.** Se seu projeto atual usa external Supabase em vez de Lovable Cloud, o webhook URL é `https://<seu-project-ref>.supabase.co/functions/v1/signdocs-webhook`. Não esqueça de fazer deploy manual da função se Cloud não estiver habilitado.

- **CSP / `frame-ancestors` para o caminho embed.** Se o projeto já tem políticas CSP customizadas e você quer usar embed (não redirect), adicione `sign-hml.signdocs.com.br` e `sign.signdocs.com.br` à `frame-src` allowed list, e peça à equipe SignDocs para liberar seu domínio na lista de `frame-ancestors` do tenant.
