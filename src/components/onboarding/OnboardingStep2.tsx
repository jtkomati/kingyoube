import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2, Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { BankConnection } from './OnboardingModal';

interface OnboardingStep2Props {
  bankConnection: BankConnection | null;
  setBankConnection: (connection: BankConnection | null) => void;
  onBack: () => void;
  onNext: () => void;
}

const banks = [
  { id: 'itau', name: 'Itaú', color: 'bg-orange-500', logo: '🏦' },
  { id: 'nubank', name: 'Nubank', color: 'bg-purple-600', logo: '💜' },
  { id: 'bradesco', name: 'Bradesco', color: 'bg-red-600', logo: '🏛️' },
  { id: 'inter', name: 'Inter', color: 'bg-orange-400', logo: '🟠' },
  { id: 'santander', name: 'Santander', color: 'bg-red-500', logo: '🔴' },
  { id: 'bb', name: 'Banco do Brasil', color: 'bg-yellow-500', logo: '🟡' },
];

export function OnboardingStep2({ bankConnection, setBankConnection, onBack, onNext }: OnboardingStep2Props) {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleBankSelect = async (bank: typeof banks[0]) => {
    if (bankConnection?.bankName === bank.name) {
      // Toggle off
      setBankConnection(null);
      return;
    }

    setConnecting(bank.id);
    
    // Simular conexão (2 segundos)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setBankConnection({
      bankName: bank.name,
      connected: true
    });
    setConnecting(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl">
          💳
        </div>
        <h2 className="text-xl font-semibold">Conexão Bancária</h2>
        <p className="text-sm text-muted-foreground">
          Onde seu dinheiro se movimenta?
        </p>
      </div>

      {/* Bank Grid */}
      <div className="grid grid-cols-3 gap-3">
        {banks.map((bank, index) => {
          const isSelected = bankConnection?.bankName === bank.name;
          const isConnecting = connecting === bank.id;
          
          return (
            <motion.button
              key={bank.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleBankSelect(bank)}
              disabled={connecting !== null}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200
                flex flex-col items-center gap-2
                ${isSelected 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
                ${isConnecting ? 'animate-pulse' : ''}
                disabled:opacity-50
              `}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              
              <span className="text-2xl">{bank.logo}</span>
              <span className="text-xs font-medium truncate w-full text-center">
                {bank.name}
              </span>
              
              {isConnecting && (
                <Loader2 className="w-4 h-4 animate-spin absolute bottom-2" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Connection Status */}
      {connecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-muted/50 rounded-xl text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-primary" />
            <span>Sincronizando com criptografia de ponta a ponta...</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2 }}
            />
          </div>
        </motion.div>
      )}

      {bankConnection?.connected && !connecting && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-primary/5 border border-primary/20 rounded-xl"
        >
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Check className="w-4 h-4" />
            {bankConnection.bankName} conectado com sucesso!
          </div>
        </motion.div>
      )}

      {/* Skip option */}
      <p className="text-xs text-center text-muted-foreground">
        Você pode pular esta etapa e conectar depois
      </p>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <Button onClick={onNext} disabled={connecting !== null}>
          {bankConnection?.connected ? 'Continuar' : 'Pular etapa'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
