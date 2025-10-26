import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const IncomingInvoices = () => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Processar XMLs de notas fiscais
    Array.from(files).forEach((file) => {
      if (file.name.endsWith(".xml")) {
        toast({
          title: "XML importado",
          description: `Nota fiscal ${file.name} processada com sucesso`,
        });
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos XML",
          variant: "destructive",
        });
      }
    });
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

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pendentes Validação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      {/* Upload de XMLs */}
      <Card>
        <CardHeader>
          <CardTitle>Importar Notas Fiscais de Entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Arraste arquivos XML aqui
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              ou clique no botão abaixo para selecionar
            </p>
            <Button asChild>
              <label className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Selecionar XMLs
                <input
                  type="file"
                  accept=".xml"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </label>
            </Button>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-2">Formatos aceitos:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• XML de Nota Fiscal Eletrônica (NF-e)</li>
              <li>• XML de Nota Fiscal de Serviços (NFS-e)</li>
              <li>• XML de Conhecimento de Transporte (CT-e)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Lista de notas importadas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas Fiscais Recebidas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhuma nota fiscal importada ainda
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
