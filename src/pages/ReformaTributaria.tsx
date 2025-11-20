import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Settings, Calculator, FileText } from "lucide-react";
import { ConfiguracoesAPI } from "@/components/reforma/ConfiguracoesAPI";
import { SimuladorTributos } from "@/components/reforma/SimuladorTributos";
import { ApuracaoAssistida } from "@/components/reforma/ApuracaoAssistida";

export default function ReformaTributaria() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Fiscal - Reforma Tributária (CBS/IBS)</h1>
        <p className="text-muted-foreground">
          Gerencie configurações, simule tributos e acompanhe apurações da nova reforma tributária
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações de API
          </TabsTrigger>
          <TabsTrigger value="simulador" className="gap-2">
            <Calculator className="h-4 w-4" />
            Simulador de Tributos
          </TabsTrigger>
          <TabsTrigger value="apuracao" className="gap-2">
            <FileText className="h-4 w-4" />
            Apuração Assistida
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <ConfiguracoesAPI />
        </TabsContent>

        <TabsContent value="simulador" className="space-y-4">
          <SimuladorTributos />
        </TabsContent>

        <TabsContent value="apuracao" className="space-y-4">
          <ApuracaoAssistida />
        </TabsContent>
      </Tabs>
    </div>
  );
}
