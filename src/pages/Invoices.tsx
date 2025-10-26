import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutgoingInvoices } from "@/components/invoices/OutgoingInvoices";
import { IncomingInvoices } from "@/components/invoices/IncomingInvoices";
import { FileText, FileInput } from "lucide-react";

const Invoices = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gradient-primary">
            Notas Fiscais
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestão completa de notas fiscais de entrada e saída
          </p>
        </div>

        <Tabs defaultValue="outgoing" className="space-y-4">
          <TabsList>
            <TabsTrigger value="outgoing" className="gap-2">
              <FileText className="h-4 w-4" />
              NFS-e Emitidas
            </TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2">
              <FileInput className="h-4 w-4" />
              Notas de Entrada
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outgoing">
            <OutgoingInvoices />
          </TabsContent>

          <TabsContent value="incoming">
            <IncomingInvoices />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
