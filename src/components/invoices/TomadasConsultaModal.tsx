import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, Search, Building2, Calendar, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Cidade {
  codigo: string;
  nome: string;
  uf: string;
  requerCertificado: boolean;
  requerLogin: boolean;
}

interface TomadasConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: () => void;
}

export function TomadasConsultaModal({ 
  open, 
  onOpenChange, 
  companyId,
  onSuccess 
}: TomadasConsultaModalProps) {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [selectedCidade, setSelectedCidade] = useState<Cidade | null>(null);
  const [periodoInicial, setPeriodoInicial] = useState("");
  const [periodoFinal, setPeriodoFinal] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");

  // Load cities on mount
  useEffect(() => {
    if (open) {
      fetchCidades();
      // Set default period (last 30 days)
      const hoje = new Date();
      const mesPassado = new Date();
      mesPassado.setDate(hoje.getDate() - 30);
      setPeriodoFinal(hoje.toISOString().split('T')[0]);
      setPeriodoInicial(mesPassado.toISOString().split('T')[0]);
    }
  }, [open]);

  const fetchCidades = async (search?: string) => {
    setLoadingCidades(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const { data, error } = await supabase.functions.invoke('consultar-cidades-tomadas', {
        body: {},
      });

      if (error) throw error;

      setCidades(data.cidades || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
      toast.error('Erro ao carregar cidades');
    } finally {
      setLoadingCidades(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCidade) {
      toast.error('Selecione uma cidade');
      return;
    }

    if (!periodoInicial || !periodoFinal) {
      toast.error('Informe o período de consulta');
      return;
    }

    if (selectedCidade.requerLogin && (!login || !senha)) {
      toast.error('Esta cidade requer login e senha');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-notas-tomadas', {
        body: {
          companyId,
          codigoCidade: selectedCidade.codigo,
          nomeCidade: selectedCidade.nome,
          periodoInicial,
          periodoFinal,
          inscricaoMunicipal: inscricaoMunicipal || undefined,
          login: login || undefined,
          senha: senha || undefined,
        },
      });

      if (error) throw error;

      toast.success(`Consulta iniciada! Protocolo: ${data.protocolo}`);
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setSelectedCidade(null);
      setLogin("");
      setSenha("");
      setInscricaoMunicipal("");
    } catch (error: unknown) {
      console.error('Error starting consultation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao iniciar consulta: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCidades = cidades.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.uf.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.codigo.includes(searchTerm)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Consultar NFS-e Tomadas
          </DialogTitle>
          <DialogDescription>
            Inicie uma consulta de notas fiscais de serviços recebidos pela sua empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* City Selection */}
          <div className="space-y-2">
            <Label htmlFor="cidade">Cidade *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-cidade"
                placeholder="Buscar cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 mb-2"
              />
            </div>
            <Select 
              value={selectedCidade?.codigo || ""} 
              onValueChange={(value) => {
                const cidade = cidades.find(c => c.codigo === value);
                setSelectedCidade(cidade || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCidades ? "Carregando..." : "Selecione a cidade"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredCidades.map((cidade) => (
                  <SelectItem key={cidade.codigo} value={cidade.codigo}>
                    {cidade.nome} - {cidade.uf}
                    {cidade.requerCertificado && " 🔐"}
                    {cidade.requerLogin && " 🔑"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show requirements info */}
          {selectedCidade && (selectedCidade.requerCertificado || selectedCidade.requerLogin) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedCidade.requerCertificado && "Esta cidade requer certificado digital. "}
                {selectedCidade.requerLogin && "Esta cidade requer login e senha da prefeitura."}
              </AlertDescription>
            </Alert>
          )}

          {/* Period Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodoInicial" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Data Inicial *
              </Label>
              <Input
                id="periodoInicial"
                type="date"
                value={periodoInicial}
                onChange={(e) => setPeriodoInicial(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodoFinal" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Data Final *
              </Label>
              <Input
                id="periodoFinal"
                type="date"
                value={periodoFinal}
                onChange={(e) => setPeriodoFinal(e.target.value)}
              />
            </div>
          </div>

          {/* Municipal Inscription */}
          <div className="space-y-2">
            <Label htmlFor="inscricaoMunicipal">Inscrição Municipal</Label>
            <Input
              id="inscricaoMunicipal"
              placeholder="Opcional - depende da cidade"
              value={inscricaoMunicipal}
              onChange={(e) => setInscricaoMunicipal(e.target.value)}
            />
          </div>

          {/* Login/Password if required */}
          {selectedCidade?.requerLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="login" className="flex items-center gap-1">
                  <Key className="h-4 w-4" />
                  Login da Prefeitura *
                </Label>
                <Input
                  id="login"
                  placeholder="Usuário do portal da prefeitura"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha *</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Senha do portal da prefeitura"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Certificate warning */}
          {selectedCidade?.requerCertificado && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Atenção: Esta cidade requer certificado digital A1. Certifique-se de que o certificado está cadastrado na plataforma.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedCidade}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : (
              'Iniciar Consulta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
