// supabase/functions/signdocs-webhook/index.ts
//
// Recebe webhooks do SignDocs Brasil, valida HMAC-SHA256 com janela
// anti-replay de 300s, e atualiza envelope_status.
// É a ÚNICA fonte da verdade para status final — sem polling, sem UI otimista.
//
// Deploy: supabase functions deploy signdocs-webhook --no-verify-jwt
//   (webhooks vêm dos servidores SignDocs, não do Supabase Auth.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const webhookSecret = Deno.env.get("SIGNDOCS_WEBHOOK_SECRET")!;
const TOLERANCE_SEC = 300;

function verify(body: string, sig: string, ts: string): boolean {
  const t = parseInt(ts, 10);
  if (isNaN(t)) return false;

  // Janela anti-replay: rejeita timestamps muito antigos ou no futuro
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > TOLERANCE_SEC) return false;

  // HMAC sobre `${timestamp}.${body}` com ponto literal
  const expected = createHmac("sha256", webhookSecret)
    .update(`${t}.${body}`)
    .digest("hex");

  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.text();
  const sig  = req.headers.get("x-signdocs-signature") ?? "";
  const ts   = req.headers.get("x-signdocs-timestamp") ?? "";

  if (!verify(body, sig, ts)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body);
  const targetSessionId = event.data?.sessionId ?? event.transactionId;

  switch (event.eventType) {
    case "SIGNING_SESSION.COMPLETED":
    case "TRANSACTION.COMPLETED":
      await supabase.from("envelope_status").update({
        status:      "COMPLETED",
        evidence_id: event.data?.evidenceId ?? null,
        updated_at:  new Date().toISOString(),
      }).eq("session_id", targetSessionId);
      break;

    case "SIGNING_SESSION.CANCELLED":
    case "TRANSACTION.CANCELLED":
      await supabase.from("envelope_status").update({
        status:     "CANCELLED",
        updated_at: new Date().toISOString(),
      }).eq("session_id", targetSessionId);
      break;

    case "SIGNING_SESSION.EXPIRED":
    case "TRANSACTION.EXPIRED":
      await supabase.from("envelope_status").update({
        status:     "EXPIRED",
        updated_at: new Date().toISOString(),
      }).eq("session_id", targetSessionId);
      break;
  }

  return new Response("ok", { status: 200 });
});
