import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  contract: any;
}

export const ContractAnalysisDialog = ({ open, onClose, contract }: ContractAnalysisDialogProps) => {
  if (!contract) return null;

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      low: "text-success",
      medium: "text-warning",
      high: "text-danger",
      critical: "text-destructive",
    };
    return colors[level] || "text-muted-foreground";
  };

  const getRiskIcon = (level: string) => {
    if (level === "critical" || level === "high") {
      return <AlertCircle className="h-5 w-5" />;
    }
    if (level === "medium") {
      return <AlertTriangle className="h-5 w-5" />;
    }
    return <CheckCircle className="h-5 w-5" />;
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-danger";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Análise de Contrato - {contract.contract_number}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Resumo Executivo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Resumo Executivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Score de Conformidade</p>
                    <div className={`text-4xl font-bold ${getComplianceColor(contract.compliance_score || 0)}`}>
                      {contract.compliance_score || 0}%
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Nível de Risco</p>
                    <div className={`flex items-center gap-2 ${getRiskColor(contract.risk_level || "low")}`}>
                      {getRiskIcon(contract.risk_level || "low")}
                      <span className="text-2xl font-bold capitalize">{contract.risk_level || "baixo"}</span>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Analisado em:</p>
                  <p className="font-medium">
                    {contract.ai_analyzed_at
                      ? format(new Date(contract.ai_analyzed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "-"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Análise Completa */}
            <Card>
              <CardHeader>
                <CardTitle>Análise Detalhada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm">
                    {contract.ai_analysis?.full_analysis || "Análise não disponível"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Principais Riscos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-danger" />
                  Principais Riscos Identificados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="border-l-4 border-danger pl-4 py-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge variant="destructive">CRÍTICO</Badge>
                      Lucros Cessantes
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cláusulas de indenização por lucros cessantes podem gerar passivos ilimitados
                    </p>
                  </div>

                  <div className="border-l-4 border-warning pl-4 py-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge variant="secondary">ALTO</Badge>
                      Multas Contratuais
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Verificar se multas estão dentro dos limites legais (máximo 10% do valor)
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Badge>MÉDIO</Badge>
                      LGPD
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Cláusulas de proteção de dados devem estar em conformidade com LGPD
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recomendações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Revisar cláusulas de lucros cessantes com advogado especializado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Limitar multas contratuais ao máximo de 10% do valor do contrato</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Incluir cláusula de proteção de dados em conformidade com LGPD</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Definir foro de eleição favorável à empresa</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>Estabelecer prazos claros para rescisão contratual</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
