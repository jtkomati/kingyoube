import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BatchInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

interface InvoiceRow {
  id: string;
  descricao: string;
  valor: number;
  tomador_cpf_cnpj: string;
  tomador_razao_social: string;
  tomador_email?: string;
  tomador_logradouro: string;
  tomador_numero: string;
  tomador_bairro: string;
  tomador_cidade_codigo: string;
  tomador_cep: string;
  tomador_uf: string;
  codigo_servico: string;
  aliquota_iss?: number;
  data_vencimento?: string;
  status?: "pending" | "processing" | "success" | "error";
  error_message?: string;
  invoice_number?: string;
}

const TEMPLATE_COLUMNS = [
  { key: "descricao", label: "Descrição do Serviço", required: true, example: "Consultoria em TI" },
  { key: "valor", label: "Valor (R$)", required: true, example: 1500.0 },
  { key: "tomador_cpf_cnpj", label: "CPF/CNPJ Tomador", required: true, example: "12.345.678/0001-90" },
  { key: "tomador_razao_social", label: "Razão Social/Nome", required: true, example: "Empresa Exemplo Ltda" },
  { key: "tomador_email", label: "Email Tomador", required: false, example: "contato@empresa.com" },
  { key: "tomador_logradouro", label: "Logradouro", required: true, example: "Av. Paulista" },
  { key: "tomador_numero", label: "Número", required: true, example: "1000" },
  { key: "tomador_bairro", label: "Bairro", required: true, example: "Bela Vista" },
  { key: "tomador_cidade_codigo", label: "Código IBGE Cidade", required: true, example: "3550308" },
  { key: "tomador_cep", label: "CEP", required: true, example: "01310-100" },
  { key: "tomador_uf", label: "UF", required: true, example: "SP" },
  { key: "codigo_servico", label: "Código Serviço", required: true, example: "01.01" },
  { key: "aliquota_iss", label: "Alíquota ISS (%)", required: false, example: 5 },
  { key: "data_vencimento", label: "Data Vencimento", required: false, example: "2025-12-31" },
];

export const BatchInvoiceDialog = ({
  open,
  onClose,
  companyId,
}: BatchInvoiceDialogProps) => {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleDownloadTemplate = () => {
    const templateData = [
      TEMPLATE_COLUMNS.reduce((acc, col) => {
        acc[col.label] = col.example;
        return acc;
      }, {} as Record<string, any>),
      TEMPLATE_COLUMNS.reduce((acc, col) => {
        acc[col.label] = col.required ? "(Obrigatório)" : "(Opcional)";
        return acc;
      }, {} as Record<string, any>),
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 25 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NFSe Lote");
    XLSX.writeFile(wb, "template_nfse_lote.xlsx");
    
    toast.success("Template baixado com sucesso");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

        // Skip the instruction row if present
        const dataRows = jsonData.filter(row => {
          const firstValue = Object.values(row)[0];
          return typeof firstValue !== "string" || !firstValue.includes("Obrigatório");
        });

        // Map columns to our format
        const mappedRows: InvoiceRow[] = dataRows.map((row, index) => {
          const mapped: InvoiceRow = {
            id: `row-${index}`,
            descricao: row["Descrição do Serviço"] || row["descricao"] || "",
            valor: parseFloat(row["Valor (R$)"] || row["valor"] || 0),
            tomador_cpf_cnpj: String(row["CPF/CNPJ Tomador"] || row["tomador_cpf_cnpj"] || ""),
            tomador_razao_social: row["Razão Social/Nome"] || row["tomador_razao_social"] || "",
            tomador_email: row["Email Tomador"] || row["tomador_email"],
            tomador_logradouro: row["Logradouro"] || row["tomador_logradouro"] || "",
            tomador_numero: String(row["Número"] || row["tomador_numero"] || "S/N"),
            tomador_bairro: row["Bairro"] || row["tomador_bairro"] || "",
            tomador_cidade_codigo: String(row["Código IBGE Cidade"] || row["tomador_cidade_codigo"] || ""),
            tomador_cep: String(row["CEP"] || row["tomador_cep"] || ""),
            tomador_uf: row["UF"] || row["tomador_uf"] || "",
            codigo_servico: row["Código Serviço"] || row["codigo_servico"] || "01.01",
            aliquota_iss: parseFloat(row["Alíquota ISS (%)"] || row["aliquota_iss"] || 5),
            data_vencimento: row["Data Vencimento"] || row["data_vencimento"],
            status: "pending",
          };
          return mapped;
        });

        // Validate rows
        const validatedRows = mappedRows.map(row => {
          const errors: string[] = [];
          if (!row.descricao) errors.push("Descrição obrigatória");
          if (!row.valor || row.valor <= 0) errors.push("Valor inválido");
          if (!row.tomador_cpf_cnpj) errors.push("CPF/CNPJ obrigatório");
          if (!row.tomador_razao_social) errors.push("Razão Social obrigatória");
          if (!row.codigo_servico) errors.push("Código serviço obrigatório");
          
          if (errors.length > 0) {
            return { ...row, status: "error" as const, error_message: errors.join(", ") };
          }
          return row;
        });

        setRows(validatedRows);
        toast.success(`${validatedRows.length} linhas carregadas`);
      } catch (error) {
        toast.error("Erro ao ler arquivo Excel");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const handleEmitBatch = async () => {
    const validRows = rows.filter(row => row.status !== "error");
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para emitir");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults({ success: 0, errors: 0 });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      // Update row status to processing
      setRows(prev => prev.map(r => 
        r.id === row.id ? { ...r, status: "processing" as const } : r
      ));

      try {
        // Create transaction first - get auth user for created_by
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Get a default category (first one available)
        const { data: defaultCategory } = await supabase
          .from("categories")
          .select("id")
          .eq("company_id", companyId)
          .limit(1)
          .maybeSingle();

        if (!defaultCategory) {
          throw new Error("Nenhuma categoria cadastrada. Crie uma categoria primeiro.");
        }

        const { data: transaction, error: txError } = await (supabase as any)
          .from("transactions")
          .insert({
            company_id: companyId,
            description: row.descricao,
            gross_amount: row.valor,
            type: "RECEIVABLE",
            due_date: row.data_vencimento || new Date().toISOString().split("T")[0],
            payment_status: "PENDING",
            created_by: user.id,
            category_id: defaultCategory.id,
          })
          .select()
          .single();

        if (txError) throw txError;

        // Create or find customer
        const cpfCnpj = row.tomador_cpf_cnpj.replace(/\D/g, "");
        const isCnpj = cpfCnpj.length > 11;
        
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("company_id", companyId)
          .or(`cpf.eq.${cpfCnpj},cnpj.eq.${cpfCnpj}`)
          .maybeSingle();

        let customerId = existingCustomer?.id;

        if (!customerId) {
          const { data: newCustomer, error: custError } = await (supabase as any)
            .from("customers")
            .insert({
              company_id: companyId,
              person_type: isCnpj ? "PJ" : "PF",
              [isCnpj ? "cnpj" : "cpf"]: cpfCnpj,
              company_name: isCnpj ? row.tomador_razao_social : undefined,
              first_name: !isCnpj ? row.tomador_razao_social.split(" ")[0] : undefined,
              last_name: !isCnpj ? row.tomador_razao_social.split(" ").slice(1).join(" ") : undefined,
              email: row.tomador_email,
              address: JSON.stringify({
                street: row.tomador_logradouro,
                number: row.tomador_numero,
                neighborhood: row.tomador_bairro,
                city_code: row.tomador_cidade_codigo,
                zip: row.tomador_cep,
                state: row.tomador_uf,
              }),
              created_by: user.id,
            })
            .select("id")
            .single();

          if (custError) throw custError;
          customerId = newCustomer?.id;
        }

        // Link customer to transaction
        await supabase
          .from("transactions")
          .update({ customer_id: customerId })
          .eq("id", transaction.id);

        // Issue invoice
        const { data: issueResult, error: issueError } = await supabase.functions.invoke("issue-nfse", {
          body: {
            transaction_id: transaction.id,
            service_code: row.codigo_servico,
            service_description: row.descricao,
          },
        });

        if (issueError) throw issueError;

        if (issueResult.success) {
          successCount++;
          setRows(prev => prev.map(r => 
            r.id === row.id ? { 
              ...r, 
              status: "success" as const, 
              invoice_number: issueResult.invoice_number 
            } : r
          ));
        } else {
          throw new Error(issueResult.message);
        }
      } catch (error: any) {
        errorCount++;
        setRows(prev => prev.map(r => 
          r.id === row.id ? { 
            ...r, 
            status: "error" as const, 
            error_message: error.message 
          } : r
        ));
      }

      setProgress(((i + 1) / validRows.length) * 100);
      setResults({ success: successCount, errors: errorCount });
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["outgoing-invoices"] });
    
    toast.success(`Processamento concluído: ${successCount} emitidas, ${errorCount} erros`);
  };

  const handleClose = () => {
    if (!isProcessing) {
      setRows([]);
      setProgress(0);
      setResults({ success: 0, errors: 0 });
      onClose();
    }
  };

  const validRowsCount = rows.filter(r => r.status === "pending").length;
  const errorRowsCount = rows.filter(r => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Emissão de NFS-e em Lote
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo Excel com os dados das notas fiscais ou baixe o template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Template Excel
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
              <div className="flex gap-4 text-sm">
                <span className="text-success flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {results.success} emitidas
                </span>
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {results.errors} erros
                </span>
              </div>
            </div>
          )}

          {/* Summary */}
          {rows.length > 0 && !isProcessing && (
            <div className="flex gap-4 text-sm">
              <Badge variant="outline" className="bg-muted">
                {rows.length} linhas totais
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success">
                {validRowsCount} válidas
              </Badge>
              {errorRowsCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive">
                  {errorRowsCount} com erro
                </Badge>
              )}
            </div>
          )}

          {/* Data preview */}
          {rows.length > 0 && (
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>NF</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.status === "pending" && (
                          <Badge variant="outline" className="bg-muted">
                            Aguardando
                          </Badge>
                        )}
                        {row.status === "processing" && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {row.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        {row.status === "error" && (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-destructive" />
                            {row.error_message && (
                              <span 
                                className="text-xs text-destructive truncate max-w-[100px]"
                                title={row.error_message}
                              >
                                {row.error_message}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.descricao}
                      </TableCell>
                      <TableCell>
                        R$ {row.valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {row.tomador_razao_social}
                      </TableCell>
                      <TableCell>
                        {row.invoice_number || "-"}
                      </TableCell>
                      <TableCell>
                        {row.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRow(row.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Empty state */}
          {rows.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhum arquivo carregado</p>
              <p className="text-sm mt-1">
                Baixe o template e preencha com os dados das notas fiscais
              </p>
            </div>
          )}

          {/* Warning for errors */}
          {errorRowsCount > 0 && !isProcessing && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg text-warning text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                {errorRowsCount} linha(s) contém erros e não serão processadas.
                Corrija os dados no arquivo e faça upload novamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {isProcessing ? "Processando..." : "Fechar"}
          </Button>
          <Button 
            onClick={handleEmitBatch} 
            disabled={validRowsCount === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Emitir {validRowsCount} Notas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
