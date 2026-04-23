// src/hooks/useSignDocs.ts
//
// Hook cliente que dispara o fluxo de assinatura. Invoca a Edge Function
// create-signing-session com o JWT do usuário logado, recebe o signingUrl
// pronto e redireciona o browser para o hosted signing.

import { supabase } from "@/integrations/supabase/client";

type StartSigningInput = {
  signerName: string;
  signerEmail: string;
  signerCpf?: string;
  pdfBase64: string;
  filename?: string;
};

export function useSignDocs() {
  async function startSigning(input: StartSigningInput) {
    const { data, error } = await supabase.functions.invoke(
      "create-signing-session",
      {
        body: {
          ...input,
          // Anexamos session_id na returnUrl para que /assinado saiba
          // qual sessão observar via Realtime.
          returnUrl: `${window.location.origin}/assinado`,
        },
      },
    );

    if (error) throw error;

    // Preserva session_id no query string para a página /assinado consumir
    const finalUrl = new URL(data.signingUrl);
    // Alguns browsers normalizam; usamos a URL retornada como está.
    // O parâmetro ?session_id= será anexado pelo SignDocs ao redirecionar
    // de volta para returnUrl. Nada a fazer aqui.
    window.location.href = finalUrl.toString();
  }

  return { startSigning };
}
