import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BalanceValidationCardProps {
  openingBalance: number | null;
  closingBalance: number | null;
  calculatedBalance: number;
  isValidated: boolean;
  difference: number | null;
}

export function BalanceValidationCard({ 
  openingBalance,
  closingBalance,
  calculatedBalance,
  isValidated,
  difference 
}: BalanceValidationCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const hasBalanceData = openingBalance !== null && closingBalance !== null;

  if (!hasBalanceData) {
    return (
      <Card className="border-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-muted/30">
              <Scale className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Validação de Saldo</p>
              <p className="text-sm text-muted-foreground italic">
                Saldo não informado pelo banco
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isValidated ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${isValidated ? "bg-green-500/10" : "bg-amber-500/10"}`}>
              {isValidated ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo do Banco</p>
              <p className="text-2xl font-bold">
                {formatCurrency(closingBalance)}
              </p>
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant={isValidated ? "default" : "destructive"}
                  className={isValidated 
                    ? "bg-green-500 hover:bg-green-600" 
                    : "bg-amber-500 hover:bg-amber-600"
                  }
                >
                  {isValidated ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Saldo Validado
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Divergência: {formatCurrency(Math.abs(difference || 0))}
                    </>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Saldo Inicial:</span>
                    <span className="font-medium">{formatCurrency(openingBalance)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Saldo Calculado:</span>
                    <span className="font-medium">{formatCurrency(calculatedBalance)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Saldo Final (Banco):</span>
                    <span className="font-medium">{formatCurrency(closingBalance)}</span>
                  </div>
                  {!isValidated && difference !== null && (
                    <>
                      <hr className="border-border" />
                      <div className="flex justify-between gap-4 text-amber-600">
                        <span>Diferença:</span>
                        <span className="font-bold">{formatCurrency(difference)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Pode haver transações não capturadas ou diferenças de arredondamento.
                      </p>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
