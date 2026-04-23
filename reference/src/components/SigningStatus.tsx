// src/components/SigningStatus.tsx
//
// Badge que mostra o status da sessão de assinatura em tempo real. Faz um
// SELECT inicial e depois se inscreve no canal Realtime filtrado pelo
// session_id — mudanças chegam via WebSocket, sem polling.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Status = "PENDING" | "COMPLETED" | "CANCELLED" | "EXPIRED";

const LABEL: Record<Status, string> = {
  PENDING:   "Aguardando assinatura",
  COMPLETED: "Assinado",
  CANCELLED: "Cancelado",
  EXPIRED:   "Expirado",
};

export function SigningStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("PENDING");

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("envelope_status")
      .select("status")
      .eq("session_id", sessionId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.status) {
          setStatus(data.status as Status);
        }
      });

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
          setStatus(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return (
    <Badge variant={status === "COMPLETED" ? "default" : "secondary"}>
      {LABEL[status]}
    </Badge>
  );
}
