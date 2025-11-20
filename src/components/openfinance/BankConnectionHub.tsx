import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";
import { BradescoConsentModal } from "./BradescoConsentModal";

interface BankConnectionHubProps {
  connectedBanks: string[];
  onBankConnected: (bankId: string) => void;
}

const availableBanks = [
  { 
    id: "bradesco", 
    name: "Bradesco", 
    color: "bg-red-600",
    textColor: "text-white",
    featured: true
  },
  { 
    id: "itau", 
    name: "Itaú", 
    color: "bg-orange-500",
    textColor: "text-white",
    featured: false
  },
  { 
    id: "bb", 
    name: "Banco do Brasil", 
    color: "bg-yellow-400",
    textColor: "text-gray-900",
    featured: false
  },
  { 
    id: "santander", 
    name: "Santander", 
    color: "bg-red-500",
    textColor: "text-white",
    featured: false
  },
  { 
    id: "caixa", 
    name: "Caixa Econômica", 
    color: "bg-blue-600",
    textColor: "text-white",
    featured: false
  },
  { 
    id: "nubank", 
    name: "Nubank", 
    color: "bg-purple-600",
    textColor: "text-white",
    featured: false
  },
];

export function BankConnectionHub({ connectedBanks, onBankConnected }: BankConnectionHubProps) {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const isConnected = (bankId: string) => connectedBanks.includes(bankId);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableBanks.map((bank) => (
          <Card 
            key={bank.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              bank.featured ? 'md:col-span-2 lg:col-span-3' : ''
            } ${isConnected(bank.id) ? 'border-green-500 border-2' : ''}`}
            onClick={() => !isConnected(bank.id) && setSelectedBank(bank.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${bank.color} ${bank.textColor} p-3 rounded-lg`}>
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{bank.name}</CardTitle>
                    <CardDescription>
                      {isConnected(bank.id) ? 'Conta conectada' : 'Clique para conectar'}
                    </CardDescription>
                  </div>
                </div>
                {isConnected(bank.id) && (
                  <Badge variant="default" className="gap-1 bg-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Conectado
                  </Badge>
                )}
                {bank.featured && !isConnected(bank.id) && (
                  <Badge variant="secondary">Destaque</Badge>
                )}
              </div>
            </CardHeader>
            {bank.featured && (
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Saldos em tempo real
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Extratos automáticos
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Conciliação inteligente
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {selectedBank === "bradesco" && (
        <BradescoConsentModal
          open={true}
          onClose={() => setSelectedBank(null)}
          onSuccess={() => {
            onBankConnected("bradesco");
            setSelectedBank(null);
          }}
        />
      )}
    </>
  );
}
