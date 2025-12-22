import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";
import { TecnoSpeedConnectButton } from "./TecnoSpeedConnectButton";
import { AccountBalanceCard } from "./AccountBalanceCard";
import { SyncProtocolsList } from "./SyncProtocolsList";
import { supabase } from "@/integrations/supabase/client";

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
    featured: true
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
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);

  const isConnected = (bankId: string) => connectedBanks.includes(bankId);

  // Load connected accounts from Supabase
  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('open_finance_status', 'connected');

    if (!error && data) {
      setConnectedAccounts(data);
    }
  };

  const handleConnectionSuccess = (bankId: string) => (itemId: string) => {
    onBankConnected(bankId);
    loadConnectedAccounts();
  };

  return (
    <>
      {/* Connected Accounts Display */}
      {connectedAccounts.length > 0 && (
        <div className="mb-6 space-y-4">
          <h2 className="text-xl font-semibold">Contas Conectadas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connectedAccounts.map((account) => (
              <AccountBalanceCard
                key={account.id}
                bankName={account.bank_name}
                accountType="Conta Corrente PJ"
                balance={account.balance || 0}
                lastUpdate={account.last_sync_at ? `Atualizado em ${new Date(account.last_sync_at).toLocaleString('pt-BR')}` : "Nunca sincronizado"}
              />
            ))}
          </div>
          <SyncProtocolsList 
            bankAccountId={connectedAccounts[0]?.id} 
            onSyncComplete={loadConnectedAccounts}
          />
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Bancos Disponíveis</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {availableBanks.map((bank) => (
          <Card 
            key={bank.id}
            className={`transition-all hover:shadow-lg ${
              bank.featured ? 'md:col-span-2 lg:col-span-3' : ''
            } ${isConnected(bank.id) ? 'border-green-500 border-2' : ''}`}
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
            {bank.featured && !isConnected(bank.id) && (
              <CardContent>
                <div className="grid gap-4">
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
                  <TecnoSpeedConnectButton 
                    bankId={bank.id}
                    onSuccess={handleConnectionSuccess(bank.id)}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        ))}
        </div>
      </div>
    </>
  );
}
