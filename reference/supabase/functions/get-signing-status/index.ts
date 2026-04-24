// supabase/functions/get-signing-status/index.ts
//
// Consulta o status de uma sessão de assinatura por session_id.
// Usada pelo frontend como FALLBACK de polling quando o canal Realtime
// não propaga o UPDATE (acontece quando o usuário é redirecionado de
// volta do SignDocs e o webhook dispara antes do canal subscribe).
//
// Deploy: supabase functions deploy get-signing-status --no-verify-jwt
//   (endpoint público — segurança vem do session_id não ser adivinhável
//   e retornar apenas status + evidence_id, sem PII do signatário.)

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { sessionId } = await req.json();

  if (typeof sessionId !== "string" || !sessionId.startsWith("ss_")) {
    return Response.json(
      { error: "sessionId inválido (esperado string começando com 'ss_')" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("envelope_status")
    .select("status, evidence_id, updated_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("get-signing-status db error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ status: "NOT_FOUND" });
  }

  return Response.json({
    status:     data.status,
    evidenceId: data.evidence_id,
    updatedAt:  data.updated_at,
  });
});
