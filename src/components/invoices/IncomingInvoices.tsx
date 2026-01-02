import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, DollarSign, Download, Eye, Trash2, RefreshCw, Settings, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";

interface IncomingInvoice {
  id: string;
  supplier_cnpj: string;
  supplier_name: string;
  invoice_number: string;
  service_code: string;
  gross_amount: number;
  irrf_amount: number;
  pis_amount: number;
  cofins_amount: number;
  csll_amount: number;
  iss_amount: number;
  inss_amount: number;
  net_amount: number;
  file_name: string;
  invoice_date: string;
  processing_status: string;
  ocr_data?: any;
}

interface PlugNotasConfig {
  plugnotas_status: string | null;
  plugnotas_environment: string | null;
  plugnotas_last_test: string | null;
}

export const IncomingInvoices = () => {
  const { toast } = useToast();
  const { currentOrganization } = useAuth();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingCNAB, setIsGeneratingCNAB] = useState(false);
  const [selectedInvoiceForOCR, setSelectedInvoiceForOCR] = useState<IncomingInvoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<IncomingInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [plugNotasConfig, setPlugNotasConfig] = useState<PlugNotasConfig | null>(null);
  const [isSyncingNfe, setIsSyncingNfe] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchInvoices();
      fetchPlugNotasConfig();
    }
  }, [currentOrganization?.id]);

  const fetchPlugNotasConfig = async () => {
    if (!currentOrganization?.id) return;

    const { data, error } = await supabase
      .from('config_fiscal')
      .select('plugnotas_status, plugnotas_environment, plugnotas_last_test')
      .eq('company_id', currentOrganization.id)
      .maybeSingle();

    if (!error && data) {
      setPlugNotasConfig(data);
    }
  };

  const handleSyncNfeDestinadas = async () => {
    setIsSyncingNfe(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-nfe-destinadas', {
        body: { company_id: currentOrganization?.id }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Sincronização concluída",
          description: data.message || `${data.imported_count || 0} NF-e importada(s).`,
        });
        await fetchInvoices();
      } else {
        throw new Error(data.error || 'Erro ao sincronizar');
      }
    } catch (error) {
      console.error('Erro ao sincronizar NF-e:', error);
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro ao buscar NF-e destinadas",
        variant: "destructive",
      });
    } finally {
      setIsSyncingNfe(false);
    }
  };

  const getPlugNotasStatusBadge = () => {
    if (!plugNotasConfig) {
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Não configurado
        </Badge>
      );
    }

    switch (plugNotasConfig.plugnotas_status) {
      case 'connected':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Conectado ({plugNotasConfig.plugnotas_environment})
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Erro de conexão
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Desconectado
          </Badge>
        );
    }
  };

  const fetchInvoices = async () => {
    if (!currentOrganization?.id) return;

    const { data, error } = await (supabase as any)
      .from('incoming_invoices')
      .select('*')
      .eq('company_id', currentOrganization.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar notas fiscais:', error);
      toast({
        title: "Erro ao carregar notas",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    console.log('Notas fiscais carregadas:', data);
    setInvoices(data || []);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xml') && !fileName.endsWith('.pdf')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, envie apenas arquivos XML ou PDF de notas fiscais.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      if (!currentOrganization?.id) {
        throw new Error('Selecione uma organização');
      }

      // Upload file to storage using company_id for tenant isolation
      const fileExt = fileName.split('.').pop();
      const filePath = `${currentOrganization.id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('invoices-pdf')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      if (fileExt === 'pdf') {
        // Process PDF with OCR
        toast({
          title: "Processando...",
          description: "Extraindo dados da nota fiscal com OCR. Isso pode levar alguns segundos.",
        });

        const { data, error: processError } = await supabase.functions.invoke(
          'process-invoice-pdf',
          {
            body: { 
              filePath: filePath,
              fileName: file.name
              // userId removed - now extracted from auth token server-side
            }
          }
        );

        if (processError) {
          // Tentar extrair mensagem de erro mais detalhada
          console.error('Erro ao processar PDF:', processError);
          
          // Se houver data com erro, usar ela
          if (data && typeof data === 'object' && 'error' in data) {
            throw new Error(data.error);
          }
          
          throw processError;
        }

        // Verificar se houve erro no sucesso false
        if (data && typeof data === 'object' && 'success' in data && !data.success) {
          throw new Error(data.error || 'Erro ao processar nota fiscal');
        }

        toast({
          title: "Sucesso!",
          description: `Nota fiscal ${file.name} processada com sucesso.`,
        });
      } else {
        // TODO: Process XML file
        toast({
          title: "Upload realizado",
          description: `Arquivo ${file.name} foi enviado. Processamento de XML em desenvolvimento.`,
        });
      }

      // Refresh the list
      await fetchInvoices();
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      
      let errorDescription = "Erro ao processar arquivo";
      if (error instanceof Error) {
        errorDescription = error.message;
        
        // Adicionar dicas para erros comuns
        if (error.message.includes('Failed to extract') || error.message.includes('imagem')) {
          errorDescription += "\n\nDica: Verifique se o PDF está legível e não está corrompido. PDFs escaneados com baixa qualidade podem falhar no processamento.";
        } else if (error.message.includes('company_id')) {
          errorDescription += "\n\nPor favor, configure sua empresa nas configurações antes de continuar.";
        }
      }
      
      toast({
        title: "Erro ao processar nota fiscal",
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGenerateCNAB = async () => {
    if (selectedInvoices.size === 0) {
      toast({
        title: "Nenhuma nota selecionada",
        description: "Selecione pelo menos uma nota fiscal para gerar o CNAB.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCNAB(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-cnab-bradesco',
        {
          body: { invoiceIds: Array.from(selectedInvoices) }
        }
      );

      if (error) throw error;

      // Download the CNAB file
      const blob = new Blob([data.cnabContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "CNAB gerado com sucesso!",
        description: `Arquivo ${data.fileName} baixado com ${data.invoiceCount} nota(s) fiscal(is).`,
      });

      // Refresh the list
      await fetchInvoices();
      setSelectedInvoices(new Set());
    } catch (error) {
      console.error('Erro ao gerar CNAB:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao gerar CNAB",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCNAB(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelection = new Set(selectedInvoices);
    if (newSelection.has(invoiceId)) {
      newSelection.delete(invoiceId);
    } else {
      newSelection.add(invoiceId);
    }
    setSelectedInvoices(newSelection);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setIsDeleting(true);

    try {
      // Extract file path from file_url if available
      const invoice = invoiceToDelete;
      
      // Delete from storage if file_url exists
      if (invoice.file_name && currentOrganization?.id) {
        // Try to delete the file from storage using company_id path
        const filePath = `${currentOrganization.id}/${invoice.file_name.split('/').pop()}`;
        await supabase.storage
          .from('invoices-pdf')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('incoming_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Nota fiscal excluída",
        description: "A nota fiscal foi removida com sucesso.",
      });

      // Refresh the list and clear selection
      await fetchInvoices();
      setInvoiceToDelete(null);
      
      // Remove from selected if it was selected
      if (selectedInvoices.has(invoice.id)) {
        const newSelection = new Set(selectedInvoices);
        newSelection.delete(invoice.id);
        setSelectedInvoices(newSelection);
      }
    } catch (error) {
      console.error('Erro ao excluir nota fiscal:', error);
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro ao excluir nota fiscal",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Processado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalReceived = invoices.reduce((sum, inv) => sum + Number(inv.gross_amount), 0);
  const totalNet = invoices.reduce((sum, inv) => sum + Number(inv.net_amount), 0);

  return (
    <div className="space-y-6">
      {/* PlugNotas Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Status PlugNotas</CardTitle>
              {getPlugNotasStatusBadge()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNfeDestinadas}
                disabled={isSyncingNfe || plugNotasConfig?.plugnotas_status !== 'connected'}
                className="gap-2"
              >
                {isSyncingNfe ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sincronizar NF-e
              </Button>
              <Link to="/invoices">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sobre a busca automática de notas</AlertTitle>
            <AlertDescription className="text-sm">
              <strong>NFS-e (Notas de Serviço):</strong> A busca automática requer integração com a prefeitura local. 
              Importe manualmente via upload de PDF/XML.
              <br />
              <strong>NF-e (Notas de Produto):</strong> Use o botão "Sincronizar NF-e" para buscar notas destinadas à sua empresa 
              (requer certificado digital A1 cadastrado na PlugNotas).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebidas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground">notas fiscais importadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalReceived)}</div>
            <p className="text-xs text-muted-foreground">valor bruto recebido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNet)}</div>
            <p className="text-xs text-muted-foreground">após retenções</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de Notas Fiscais</CardTitle>
          <CardDescription>
            Faça upload dos arquivos XML ou PDF das notas fiscais de entrada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-6 md:p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto h-8 w-8 md:h-12 md:w-12 text-muted-foreground mb-2 md:mb-4" />
            <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2">
              {isMobile ? 'Selecione um arquivo' : 'Arraste arquivos XML ou PDF aqui'}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-4">
              {isMobile ? 'XML ou PDF' : 'ou clique no botão abaixo para selecionar'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label htmlFor="file-upload">
              <Button asChild disabled={isUploading}>
                <span>{isUploading ? 'Processando...' : 'Selecionar Arquivos'}</span>
              </Button>
            </label>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2">Formatos aceitos:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• NFS-e (Nota Fiscal de Serviços Eletrônica) - XML ou PDF</li>
              <li>• NF-e (Nota Fiscal Eletrônica) - XML ou PDF</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Notas Fiscais Importadas</CardTitle>
                <CardDescription>
                  {invoices.length} nota(s) fiscal(is) processada(s)
                </CardDescription>
              </div>
              <Button 
                onClick={handleGenerateCNAB}
                disabled={selectedInvoices.size === 0 || isGeneratingCNAB}
                className="w-full md:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {isGeneratingCNAB ? 'Gerando...' : `Gerar CNAB (${selectedInvoices.size})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <Card key={invoice.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedInvoices.has(invoice.id)}
                            onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                          />
                          {getStatusBadge(invoice.processing_status)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInvoiceForOCR(invoice)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInvoiceToDelete(invoice)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nº Nota:</span>
                          <span className="font-mono font-medium">{invoice.invoice_number || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Data:</span>
                          <span className="font-mono">{invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground">Fornecedor:</span>
                          <span className="font-medium">{invoice.supplier_name}</span>
                          <span className="font-mono text-xs">{invoice.supplier_cnpj}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Valor Bruto:</span>
                            <span className="font-semibold">{formatCurrency(invoice.gross_amount)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-muted-foreground">Valor Líquido:</span>
                            <span className="font-semibold">{formatCurrency(invoice.net_amount)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedInvoices.size === invoices.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
                            } else {
                              setSelectedInvoices(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nº Nota</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Cód. Serviço</TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right">IRRF</TableHead>
                      <TableHead className="text-right">PIS</TableHead>
                      <TableHead className="text-right">COFINS</TableHead>
                      <TableHead className="text-right">CSLL</TableHead>
                      <TableHead className="text-right">ISS</TableHead>
                      <TableHead className="text-right">INSS</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedInvoices.has(invoice.id)}
                            onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedInvoiceForOCR(invoice)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInvoiceToDelete(invoice)}
                              title="Excluir nota fiscal"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.processing_status)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {invoice.invoice_number || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {invoice.invoice_date ? formatDate(invoice.invoice_date) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {invoice.supplier_cnpj}
                        </TableCell>
                        <TableCell>{invoice.supplier_name}</TableCell>
                        <TableCell>{invoice.service_code || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.gross_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.irrf_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.pis_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.cofins_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.csll_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.iss_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.inss_amount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(invoice.net_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedInvoiceForOCR} onOpenChange={() => setSelectedInvoiceForOCR(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados do OCR - Nota Fiscal</DialogTitle>
            <DialogDescription>
              Informações extraídas automaticamente da nota fiscal
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoiceForOCR && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">Fornecedor</h3>
                  <p className="text-sm">{selectedInvoiceForOCR.supplier_name}</p>
                  <p className="text-sm font-mono">{selectedInvoiceForOCR.supplier_cnpj}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground">Nota Fiscal</h3>
                  <p className="text-sm">Nº {selectedInvoiceForOCR.invoice_number || 'N/A'}</p>
                  <p className="text-sm">{selectedInvoiceForOCR.invoice_date ? formatDate(selectedInvoiceForOCR.invoice_date) : 'N/A'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Valores</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Valor Bruto:</span>
                    <span className="font-semibold">{formatCurrency(selectedInvoiceForOCR.gross_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IRRF:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.irrf_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PIS:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.pis_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COFINS:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.cofins_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CSLL:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.csll_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ISS:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.iss_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>INSS:</span>
                    <span>{formatCurrency(selectedInvoiceForOCR.inss_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Valor Líquido:</span>
                    <span className="font-semibold">{formatCurrency(selectedInvoiceForOCR.net_amount)}</span>
                  </div>
                </div>
              </div>

              {selectedInvoiceForOCR.ocr_data && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Dados Brutos do OCR</h3>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedInvoiceForOCR.ocr_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
        title="Excluir Nota Fiscal"
        description={`Tem certeza que deseja excluir a nota fiscal ${invoiceToDelete?.invoice_number || 'selecionada'}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteInvoice}
        confirmText={isDeleting ? 'Excluindo...' : 'Excluir'}
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};