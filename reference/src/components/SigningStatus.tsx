// src/components/SigningStatus.tsx
//
// Badge que mostra o status da sessão de assinatura em tempo real.
//
// ARQUITETURA DE 3 CAMADAS (para garantir convergência mesmo quando
// o Realtime falha silenciosamente):
//
//   1. Realtime (caminho feliz) — recebe UPDATE instantâneo quando
//      o webhook atualiza a linha. Latência < 500ms.
//
//   2. Refetch no SUBSCRIBED — quando o canal confirma subscrição,
//      imediatamente buscamos o status atual. Cobre o caso em que o
//      UPDATE aconteceu ANTES do subscribe (redirect do SignDocs
//      bate no /assinado mais rápido que o handshake do Realtime).
//
//   3. Polling leve a cada 3s — enquanto status ainda é PENDING,
//      chamamos get-signing-status. Fallback total para qualquer
//      falha silenciosa do Realtime.
//
// Sem essas 3 camadas, a página /assinado pode ficar presa em
// "Aguardando assinatura" eternamente, mesmo com o banco já atualizado.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Status = "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "FAILED" | "NOT_FOUND";

const LABEL: Record<Status, string> = {
  PENDING:   "Aguardando assinatura",
  COMPLETED: "Assinado",
  CANCELLED: "Cancelado",
  EXPIRED:   "Expirado",
  FAILED:    "Falhou",
  NOT_FOUND: "Sessão não encontrada",
};

const POLL_INTERVAL_MS = 3000;

async function fetchStatus(sessionId: string): Promise<Status> {
  const { data, error } = await supabase.functions.invoke("get-signing-status", {
    body: { sessionId },
  });
  if (error) {
    console.error("get-signing-status error:", error);
    return "PENDING"; // mantém o estado anterior; erro não significa status mudou
  }
  return (data?.status ?? "PENDING") as Status;
}

export function SigningStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("PENDING");
  const statusRef = useRef<Status>("PENDING");
  statusRef.current = status;

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const update = (next: Status) => {
      if (!cancelled) setStatus(next);
    };

    // Camada 1: fetch inicial (bypassa RLS via get-signing-status)
    fetchStatus(sessionId).then(update);

    // Camada 2: Realtime + refetch no SUBSCRIBED
    const channel = supabase
      .channel(`envelope:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "envelope_status",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const next = (payload.new as { status: Status }).status;
          update(next);
        },
      )
      .subscribe((channelStatus) => {
        if (channelStatus === "SUBSCRIBED") {
          // Refetch no momento da subscrição — garante que pegamos um
          // UPDATE que aconteceu ANTES do subscribe completar.
          fetchStatus(sessionId).then(update);
        }
      });

    // Camada 3: polling leve enquanto ainda está PENDING
    pollTimer = setInterval(() => {
      if (statusRef.current === "PENDING") {
        fetchStatus(sessionId).then(update);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [sessionId]);

  return (
    <Badge variant={status === "COMPLETED" ? "default" : "secondary"}>
      {LABEL[status]}
    </Badge>
  );
}
