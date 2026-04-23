// src/pages/Assinado.tsx
//
// Página de retorno após o usuário completar (ou cancelar) a assinatura
// no hosted signing. Mostra o status em tempo real via <SigningStatus />,
// observando a tabela envelope_status pelo Supabase Realtime.
//
// O SignDocs redireciona com ?session_id=<id> na returnUrl quando
// aplicável. Se o param não estiver presente, mostramos mensagem genérica.

import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SigningStatus } from "@/components/SigningStatus";

export default function Assinado() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle>Obrigado!</CardTitle>
          <CardDescription>
            Sua assinatura foi registrada no SignDocs Brasil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionId ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <SigningStatus sessionId={sessionId} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Você será notificado por email quando todos os signatários concluírem.
            </p>
          )}

          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
