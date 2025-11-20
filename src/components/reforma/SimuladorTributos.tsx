import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Calculator, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function SimuladorTributos() {
  const { toast } = useToast();
  const [valorOperacao, setValorOperacao] = useState("");
  const [codigoProduto, setCodigoProduto] = useState("");
  const [tipoRegime, setTipoRegime] = useState("");
  const [dataOperacao, setDataOperacao] = useState<Date>();
  const [calculating, setCalculating] = useState(false);
  const [resultado, setResultado] = useState<{
    aliquota: number;
    valorCBS: number;
    valorIBS: number;
    fundamentacao: string;
  } | null>(null);

  const handleCalcular = async () => {
    if (!valorOperacao || !codigoProduto || !tipoRegime || !dataOperacao) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para calcular.",
        variant: "destructive",
      });
      return;
    }

    setCalculating(true);
    
    // Simular chamada à API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const valor = parseFloat(valorOperacao.replace(/\D/g, "")) / 100;
    const aliquota = tipoRegime === "nao-cumulativo" ? 12.5 : 8.3;
    const valorTotal = (valor * aliquota) / 100;
    
    setResultado({
      aliquota,
      valorCBS: valorTotal * 0.6,
      valorIBS: valorTotal * 0.4,
      fundamentacao: "Lei Complementar nº 214/2025, Art. 12, § 2º - Regime " + 
        (tipoRegime === "nao-cumulativo" ? "Não Cumulativo" : "Cumulativo")
    });
    
    setCalculating(false);
    
    toast({
      title: "Cálculo concluído",
      description: "Os tributos foram calculados com sucesso.",
    });
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Dados da Operação
          </CardTitle>
          <CardDescription>
            Insira os dados para calcular CBS e IBS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valor">Valor da Operação (R$)</Label>
            <Input
              id="valor"
              type="text"
              placeholder="R$ 0,00"
              value={valorOperacao ? formatCurrency(valorOperacao) : ""}
              onChange={(e) => setValorOperacao(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="codigo">Código do Produto/Serviço (NCM/NBS)</Label>
            <div className="flex gap-2">
              <Input
                id="codigo"
                type="text"
                placeholder="Ex: 8471.30.12"
                value={codigoProduto}
                onChange={(e) => setCodigoProduto(e.target.value)}
              />
              <Button variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="regime">Tipo de Regime</Label>
            <Select value={tipoRegime} onValueChange={setTipoRegime}>
              <SelectTrigger id="regime">
                <SelectValue placeholder="Selecione o regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cumulativo">Cumulativo</SelectItem>
                <SelectItem value="nao-cumulativo">Não Cumulativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data da Operação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataOperacao && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataOperacao ? (
                    format(dataOperacao, "PPP", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataOperacao}
                  onSelect={setDataOperacao}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button 
            className="w-full" 
            onClick={handleCalcular}
            disabled={calculating}
          >
            {calculating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Calcular Tributos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado do Cálculo</CardTitle>
          <CardDescription>
            Valores calculados com base nos dados informados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resultado ? (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Alíquota Aplicada</span>
                    <Badge variant="secondary">{resultado.aliquota}%</Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Valor da CBS</span>
                    <span className="text-lg font-bold">
                      {resultado.valorCBS.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Valor do IBS (previsão)</span>
                    <span className="text-lg font-bold">
                      {resultado.valorIBS.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total a Pagar</span>
                    <span className="text-xl font-bold text-primary">
                      {(resultado.valorCBS + resultado.valorIBS).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Fundamentação Legal:</strong> {resultado.fundamentacao}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                Preencha os dados e clique em "Calcular Tributos"<br />
                para ver o resultado aqui
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
