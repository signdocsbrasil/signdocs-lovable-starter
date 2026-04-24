// supabase/functions/create-signing-session/index.ts
//
// Cria uma sessão de assinatura no SignDocs Brasil a partir de dados do
// usuário logado no app. Chamada pelo frontend via supabase.functions.invoke().
//
// Deploy: supabase functions deploy create-signing-session
//   (SEM --no-verify-jwt — esta função exige usuário autenticado.)
//
// NOTAS DE TESTE REAL (2026-04-23):
//   1. CPF é OBRIGATÓRIO — SignDocs rejeita sessões sem CPF.
//   2. Usamos session.sessionId (NÃO session.id — esse vem como null).
//   3. returnUrl deve vir LIMPO — SignDocs adiciona ?session_id= no redirect.

import { SignDocsBrasilClient } from "npm:@signdocs-brasil/api@1.3.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const signdocs = new SignDocsBrasilClient({
  clientId:     Deno.env.get("SIGNDOCS_CLIENT_ID")!,
  clientSecret: Deno.env.get("SIGNDOCS_CLIENT_SECRET")!,
  baseUrl:      Deno.env.get("SIGNDOCS_BASE_URL")!,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 1) Autentica o chamador — exige JWT válido do Supabase Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: userData, error: userErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !userData.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2) Lê o payload
  const body = await req.json();
  const {
    signerName,
    signerEmail,
    signerCpf,
    pdfBase64,
    filename,
    returnUrl,
  } = body;

  // 3) Valida CPF — obrigatório para o SignDocs aceitar a sessão
  const cpfDigits = signerCpf ? normalizeCpf(signerCpf) : "";
  if (cpfDigits.length !== 11) {
    return Response.json(
      { error: "CPF é obrigatório e deve ter 11 dígitos." },
      { status: 400 },
    );
  }

  // 4) Valida returnUrl — rejeita placeholders tipo __SESSION_ID__ que podem
  //    ter vazado do frontend. SignDocs adiciona session_id automaticamente.
  if (returnUrl?.includes("__SESSION_ID__")) {
    return Response.json(
      { error: "returnUrl não deve conter placeholders. Passe a URL limpa; SignDocs adiciona ?session_id automaticamente no redirect." },
      { status: 400 },
    );
  }

  // 5) Cria a sessão de assinatura no SignDocs
  const session = await signdocs.signingSessions.create({
    purpose: "DOCUMENT_SIGNATURE",
    policy:  { profile: "CLICK_ONLY" },
    signer: {
      name:           signerName,
      email:          signerEmail,
      cpf:            cpfDigits,
      userExternalId: userData.user.id,
    },
    document: { content: pdfBase64, filename: filename ?? "contrato.pdf" },
    returnUrl,
    locale: "pt-BR",
  });

  // 6) Monta o signingUrl — OBRIGATÓRIO combinar url + ?cs=<clientSecret>
  //    Sem o ?cs, a página hospedada retorna 401.
  const signingUrl = `${session.url}?cs=${encodeURIComponent(session.clientSecret)}`;

  // 7) Persiste o status inicial. session.sessionId (não session.id — esse
  //    campo não existe no retorno do SDK e vem undefined).
  await supabase.from("envelope_status").upsert({
    session_id:     session.sessionId,
    transaction_id: session.transactionId,
    user_id:        userData.user.id,
    status:         "PENDING",
  });

  return Response.json({
    sessionId: session.sessionId,
    signingUrl,
    expiresAt: session.expiresAt,
  });
});
