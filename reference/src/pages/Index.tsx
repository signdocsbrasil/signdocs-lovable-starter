// src/pages/Index.tsx
//
// Página inicial do starter: formulário de signatário + upload de PDF +
// botão "Enviar para assinatura". Exige usuário logado via Supabase Auth.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SignButton } from "@/components/SignButton";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader devolve "data:application/pdf;base64,..." — remove o prefixo
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState("");

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendMagicLink() {
    const { error } = await supabase.auth.signInWithOtp({ email: loginEmail });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link mágico para seu email.");
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setPdfBase64(await fileToBase64(f));
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Receba um link mágico no seu email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="email"
              placeholder="voce@empresa.com.br"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <Button onClick={sendMagicLink} className="w-full">
              Enviar link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSend =
    !!pdfBase64 && signerName.trim().length > 1 && /@/.test(signerEmail);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Enviar contrato para assinatura</CardTitle>
          <CardDescription>
            Assinatura com validade jurídica brasileira via SignDocs Brasil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf">PDF do contrato</Label>
            <Input id="pdf" type="file" accept=".pdf" onChange={onFileChange} />
            {filename && (
              <p className="text-xs text-muted-foreground">{filename}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome do signatário</Label>
            <Input
              id="name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Maria Silva"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email do signatário</Label>
            <Input
              id="email"
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="maria@empresa.com.br"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF (opcional)</Label>
            <Input
              id="cpf"
              value={signerCpf}
              onChange={(e) => setSignerCpf(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="pt-2">
            {pdfBase64 && (
              <SignButton
                pdfBase64={pdfBase64}
                filename={filename ?? undefined}
                signer={{
                  name:  signerName,
                  email: signerEmail,
                  cpf:   signerCpf || undefined,
                }}
                disabled={!canSend}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
