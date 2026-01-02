import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Upload, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Eye, 
  EyeOff,
  Loader2,
  Trash2,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Certificate {
  id: string;
  nome: string | null;
  cnpj: string | null;
  vencimento: string | null;
  ativo: boolean;
  file_url: string | null;
  created_at: string;
}

interface CertificateUploadProps {
  companyId: string;
  companyCnpj: string;
  onUploadSuccess?: (certificate: Certificate) => void;
}

export function CertificateUpload({ companyId, companyCnpj, onUploadSuccess }: CertificateUploadProps) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchCertificate();
    }
  }, [companyId]);

  const fetchCertificate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("certificados_digitais")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCertificate(data);
    } catch (error: any) {
      console.error("Error fetching certificate:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file extension
      const validExtensions = [".pfx", ".p12"];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
      if (!validExtensions.includes(ext)) {
        toast.error("Arquivo inválido. Selecione um arquivo .pfx ou .p12");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !password) {
      toast.error("Selecione o arquivo e informe a senha do certificado");
      return;
    }

    setUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      // Validate certificate via edge function
      const { data: validationData, error: validationError } = await supabase.functions.invoke("validate-certificate", {
        body: {
          certificate_base64: fileBase64,
          password: password,
          company_cnpj: companyCnpj,
        },
      });

      if (validationError) throw validationError;
      if (!validationData.valid) {
        toast.error(validationData.error || "Certificado inválido");
        return;
      }

      // Upload file to storage
      const filePath = `${companyId}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("digital-certificates")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Deactivate previous certificates
      if (certificate) {
        await supabase
          .from("certificados_digitais")
          .update({ ativo: false })
          .eq("id", certificate.id);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Save certificate metadata
      const { data: newCert, error: insertError } = await supabase
        .from("certificados_digitais")
        .insert({
          company_id: companyId,
          nome: validationData.subject_name || selectedFile.name,
          cnpj: validationData.cnpj || companyCnpj,
          vencimento: validationData.valid_until,
          file_url: filePath,
          ativo: true,
          created_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCertificate(newCert);
      setSelectedFile(null);
      setPassword("");
      toast.success("Certificado digital cadastrado com sucesso!");
      onUploadSuccess?.(newCert);
    } catch (error: any) {
      console.error("Error uploading certificate:", error);
      toast.error(error.message || "Erro ao cadastrar certificado");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveCertificate = async () => {
    if (!certificate) return;

    try {
      // Deactivate certificate
      const { error } = await supabase
        .from("certificados_digitais")
        .update({ ativo: false })
        .eq("id", certificate.id);

      if (error) throw error;

      setCertificate(null);
      toast.success("Certificado removido com sucesso");
    } catch (error: any) {
      console.error("Error removing certificate:", error);
      toast.error("Erro ao remover certificado");
    }
  };

  const getCertificateStatus = () => {
    if (!certificate?.vencimento) return null;

    const expiryDate = new Date(certificate.vencimento);
    const daysUntilExpiry = differenceInDays(expiryDate, new Date());

    if (isPast(expiryDate)) {
      return { status: "expired", label: "Expirado", color: "destructive" as const };
    } else if (daysUntilExpiry <= 30) {
      return { status: "expiring", label: `Expira em ${daysUntilExpiry} dias`, color: "secondary" as const };
    } else {
      return { status: "valid", label: "Ativo", color: "default" as const };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = getCertificateStatus();

  return (
    <div className="space-y-4">
      {certificate ? (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {status?.status === "expired" ? (
                  <ShieldAlert className="h-8 w-8 text-destructive mt-0.5" />
                ) : status?.status === "expiring" ? (
                  <Shield className="h-8 w-8 text-yellow-500 mt-0.5" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-green-500 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{certificate.nome || "Certificado A1"}</span>
                    <Badge variant={status?.color}>{status?.label}</Badge>
                  </div>
                  {certificate.cnpj && (
                    <p className="text-sm text-muted-foreground">CNPJ: {certificate.cnpj}</p>
                  )}
                  {certificate.vencimento && (
                    <p className="text-sm text-muted-foreground">
                      Validade: {format(new Date(certificate.vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleRemoveCertificate}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {status?.status === "expired" && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Certificado expirado. Faça upload de um novo certificado para continuar emitindo notas.</span>
              </div>
            )}

            {status?.status === "expiring" && (
              <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Certificado próximo do vencimento. Providencie a renovação.</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Shield className="h-8 w-8" />
              <div>
                <p className="font-medium">Nenhum certificado cadastrado</p>
                <p className="text-sm">Faça upload do certificado digital A1 para emitir notas fiscais</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Form */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {certificate ? "Atualizar Certificado" : "Carregar Certificado A1"}
          </span>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="certificate-file">Arquivo do Certificado (.pfx ou .p12)</Label>
            <Input
              id="certificate-file"
              type="file"
              accept=".pfx,.p12"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{selectedFile.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate-password">Senha do Certificado</Label>
            <div className="relative">
              <Input
                id="certificate-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do certificado"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !password || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando e salvando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Validar e Salvar Certificado
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
