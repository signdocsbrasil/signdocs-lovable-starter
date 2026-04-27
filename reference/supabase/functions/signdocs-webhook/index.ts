// supabase/functions/signdocs-webhook/index.ts
//
// Recebe webhooks do SignDocs Brasil, valida HMAC-SHA256 com janela
// anti-replay de 300s, e atualiza envelope_status.
//
// Deploy: supabase functions deploy signdocs-webhook --no-verify-jwt
//   (webhooks vêm dos servidores SignDocs, não do Supabase Auth.)
//
// NOTAS DE TESTE REAL (atualizado 2026-04-27):
//   1. Deno NÃO tem Buffer global — usamos hexToBytes() + Uint8Array.
//   2. Eventos chegam em três famílias dependendo do flow:
//        - TRANSACTION.* / SIGNING_SESSION.*  por sessão (single-signer ou per-signer dentro de envelope)
//        - ENVELOPE.*                         por envelope inteiro (ALL_SIGNED, EXPIRED, CREATED)
//      Para single-signer, só TRANSACTION.* / SIGNING_SESSION.* chegam.
//      Para envelopes, ENVELOPE.ALL_SIGNED é o sinal limpo de "fechou com sucesso";
//      ENVELOPE.EXPIRED é o sinal de "envelope expirou com pendências".
//   3. UPDATE tenta transaction_id E session_id — cobre variações de payload de
//      sessão. Para eventos ENVELOPE.*, fazemos match por envelope_id (no payload).
//   4. Logamos payload e # linhas afetadas — fundamental para debug remoto.

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac, timingSafeEqual } from "node:crypto";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const webhookSecret = Deno.env.get("SIGNDOCS_WEBHOOK_SECRET")!;
const TOLERANCE_SEC = 300;

// Deno-native: converte hex string para Uint8Array.
// Buffer.from(hex, "hex") seria equivalente no Node, mas Buffer não é global no Deno.
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function verify(body: string, sig: string, ts: string): boolean {
  const t = parseInt(ts, 10);
  if (isNaN(t)) return false;

  // Janela anti-replay: rejeita timestamps muito antigos ou no futuro
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > TOLERANCE_SEC) return false;

  // HMAC sobre `${timestamp}.${body}` com ponto literal
  const expected = createHmac("sha256", webhookSecret)
    .update(`${t}.${body}`)
    .digest("hex");

  if (sig.length !== expected.length) return false;

  // Converte ambos para bytes ANTES de comparar (timingSafeEqual exige ArrayBufferView).
  const a = hexToBytes(sig);
  const b = hexToBytes(expected);
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

  // Log para debug remoto — visível em Supabase → Functions → signdocs-webhook → Logs.
  // O payload real tem eventType + transactionId + (opcionalmente) data.sessionId.
  console.log("signdocs-webhook event received:", {
    eventType:         event.eventType,
    transactionId:     event.transactionId,
    dataSessionId:     event.data?.sessionId,
    dataTransactionId: event.data?.transactionId,
  });

  // Mapa do eventType para novo status. SignDocs emite eventos em três
  // famílias; o switch abaixo cobre todas. SIGNING_SESSION.* dispara em
  // paralelo a TRANSACTION.* quando a transação foi criada via
  // /v1/signing-sessions — ambas mapeiam para o mesmo status.
  const statusMap: Record<string, string> = {
    // Por sessão / signatário individual
    "TRANSACTION.COMPLETED":     "COMPLETED",
    "SIGNING_SESSION.COMPLETED": "COMPLETED",
    "TRANSACTION.CANCELLED":     "CANCELLED",
    "SIGNING_SESSION.CANCELLED": "CANCELLED",
    "TRANSACTION.EXPIRED":       "EXPIRED",
    "SIGNING_SESSION.EXPIRED":   "EXPIRED",
    "TRANSACTION.FAILED":        "FAILED",
    // Por envelope inteiro (apenas multi-signer)
    "ENVELOPE.ALL_SIGNED":       "COMPLETED",
    "ENVELOPE.EXPIRED":          "EXPIRED",
  };
  const newStatus = statusMap[event.eventType];
  if (!newStatus) {
    return new Response("ok", { status: 200 });
  }

  const patch: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "COMPLETED" && event.data?.evidenceId) {
    patch.evidence_id = event.data.evidenceId;
  }

  // ENVELOPE.* events trazem envelopeId no payload, NÃO transactionId.
  // Match por envelope_id; eventos por sessão usam o caminho padrão.
  const isEnvelopeEvent = event.eventType.startsWith("ENVELOPE.");
  const envelopeId = event.payload?.envelopeId;

  let query = supabase.from("envelope_status").update(patch);
  if (isEnvelopeEvent && envelopeId) {
    query = query.eq("envelope_id", envelopeId);
  } else {
    // UPDATE tenta transaction_id primeiro (SignDocs sempre manda), depois
    // cai para session_id (alguns payloads têm data.sessionId preenchido).
    // A OR garante que cobrimos ambos os casos sem duplicar linha.
    query = query.or(
      `transaction_id.eq.${event.transactionId}` +
      (event.data?.sessionId ? `,session_id.eq.${event.data.sessionId}` : ""),
    );
  }
  const { data, error } = await query.select();

  if (error) {
    console.error("update envelope_status error:", error);
    return new Response(`DB error: ${error.message}`, { status: 500 });
  }

  console.log("update envelope_status rows:", data?.length ?? 0, {
    column: "transaction_id",
    value:  event.transactionId,
  });

  return new Response("ok", { status: 200 });
});
