import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, DollarSign, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

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
}

export const IncomingInvoices = () => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingCNAB, setIsGeneratingCNAB] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await (supabase as any)
      .from('incoming_invoices')
      .select('*')
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

      // Upload file to storage
      const fileExt = fileName.split('.').pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      
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
              fileName: file.name,
              userId: user.id
            }
          }
        );

        if (processError) throw processError;

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
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Arraste arquivos XML ou PDF aqui
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              ou clique no botão abaixo para selecionar
            </p>
            <input
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notas Fiscais Importadas</CardTitle>
                <CardDescription>
                  {invoices.length} nota(s) fiscal(is) processada(s)
                </CardDescription>
              </div>
              <Button 
                onClick={handleGenerateCNAB}
                disabled={selectedInvoices.size === 0 || isGeneratingCNAB}
              >
                <Download className="mr-2 h-4 w-4" />
                {isGeneratingCNAB ? 'Gerando...' : `Gerar CNAB (${selectedInvoices.size})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};