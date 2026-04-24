// src/hooks/useSignDocs.ts
//
// Hook cliente que dispara o fluxo de assinatura. Invoca a Edge Function
// create-signing-session com o JWT do usuário logado, recebe o signingUrl
// pronto e redireciona o browser para o hosted signing.

import { supabase } from "@/integrations/supabase/client";

type StartSigningInput = {
  signerName:  string;
  signerEmail: string;
  signerCpf:   string;   // obrigatório — SignDocs rejeita sessões sem CPF
  pdfBase64:   string;
  filename?:   string;
};

export function useSignDocs() {
  async function startSigning(input: StartSigningInput) {
    // Validação final: 11 dígitos no CPF
    const cpfDigits = input.signerCpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      throw new Error("CPF é obrigatório e deve ter 11 dígitos.");
    }

    const { data, error } = await supabase.functions.invoke(
      "create-signing-session",
      {
        body: {
          ...input,
          signerCpf: cpfDigits,
          // returnUrl LIMPO — sem placeholders. SignDocs adiciona ?session_id= no
          // redirect de sucesso automaticamente. Qualquer manipulação manual
          // aqui duplicaria ou corromperia o query param.
          returnUrl: `${window.location.origin}/assinado`,
        },
      },
    );

    if (error) throw error;

    window.location.href = data.signingUrl;
  }

  return { startSigning };
}
