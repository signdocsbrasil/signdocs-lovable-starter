// src/components/SignButton.tsx
//
// Botão pronto para o fluxo de assinatura. Encapsula o hook e lida com o
// estado de loading. Use em qualquer tela que já tenha o PDF carregado.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSignDocs } from "@/hooks/useSignDocs";
import { toast } from "sonner";

type Props = {
  pdfBase64: string;
  filename?: string;
  signer: {
    name: string;
    email: string;
    cpf?: string;
  };
  disabled?: boolean;
};

export function SignButton({ pdfBase64, filename, signer, disabled }: Props) {
  const { startSigning } = useSignDocs();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await startSigning({
        signerName:  signer.name,
        signerEmail: signer.email,
        signerCpf:   signer.cpf,
        pdfBase64,
        filename,
      });
      // startSigning redireciona para o hosted signing; o código abaixo
      // não executa em condições normais.
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao iniciar assinatura",
      );
      setLoading(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={disabled || loading}>
      {loading ? "Preparando…" : "Enviar para assinatura"}
    </Button>
  );
}
