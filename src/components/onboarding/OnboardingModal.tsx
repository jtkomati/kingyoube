import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingStep1 } from './OnboardingStep1';
import { OnboardingStep2 } from './OnboardingStep2';
import { OnboardingStep3 } from './OnboardingStep3';

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface CNPJData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  cnae: number;
  cnaeDescricao: string;
  regimeTributario: string;
  municipio: string;
  uf: string;
  situacao: string;
}

export interface CompanyFormData {
  cnpj: string;
  companyName: string;
  tradeName: string;
  address: string;
  taxRegime: string;
}

export interface BankConnection {
  bankName: string;
  connected: boolean;
}

export interface AccountantInvite {
  email: string;
  crc: string;
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(false);
  
  // Form data across steps
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    cnpj: '',
    companyName: '',
    tradeName: '',
    address: '',
    taxRegime: 'SIMPLES'
  });
  const [bankConnection, setBankConnection] = useState<BankConnection | null>(null);
  const [accountantInvite, setAccountantInvite] = useState<AccountantInvite | null>(null);
  
  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setDirection(1);
      setCompanyData({
        cnpj: '',
        companyName: '',
        tradeName: '',
        address: '',
        taxRegime: 'SIMPLES'
      });
      setBankConnection(null);
      setAccountantInvite(null);
    }
  }, [open]);

  const goToStep = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Criar company_settings
      const { data: company, error: companyError } = await supabase
        .from('company_settings')
        .insert({
          cnpj: companyData.cnpj.replace(/\D/g, ''),
          company_name: companyData.companyName,
          nome_fantasia: companyData.tradeName || companyData.companyName,
          address: companyData.address,
          tax_regime: companyData.taxRegime,
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. Vincular usuário à organização
      const { error: orgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: company.id,
          is_default: true
        });

      if (orgError) throw orgError;

      // 3. Criar role ADMIN
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'ADMIN'
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // 4. Atualizar profile
      await supabase
        .from('profiles')
        .update({ company_id: company.id })
        .eq('id', user.id);

      // 5. Salvar conexão bancária se houver
      if (bankConnection?.connected) {
        await supabase
          .from('bank_accounts')
          .insert({
            company_id: company.id,
            bank_name: bankConnection.bankName,
            open_finance_status: 'connected'
          });
      }

      // 6. Enviar convite ao contador se houver
      if (accountantInvite?.email) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase
          .from('invitations')
          .insert({
            organization_id: company.id,
            invited_by: user.id,
            email: accountantInvite.email,
            crc: accountantInvite.crc,
            role: 'CONTADOR',
            expires_at: expiresAt.toISOString()
          });
      }

      // 🎉 Confetti!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e']
      });

      toast({
        title: '🎉 Onboarding concluído!',
        description: 'Já analisei seu saldo e categorizei 15 lançamentos para você!'
      });

      setTimeout(() => {
        onOpenChange(false);
        navigate('/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast({
        title: 'Erro ao finalizar',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0
    })
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Neon progress bar */}
        <div className="h-1 bg-muted relative overflow-hidden">
          <motion.div
            className="absolute h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)),0_0_20px_hsl(var(--primary))]"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <div className="p-6 min-h-[400px] relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <OnboardingStep1
                  companyData={companyData}
                  setCompanyData={setCompanyData}
                  onNext={() => goToStep(2)}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <OnboardingStep2
                  bankConnection={bankConnection}
                  setBankConnection={setBankConnection}
                  onBack={() => goToStep(1)}
                  onNext={() => goToStep(3)}
                />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <OnboardingStep3
                  accountantInvite={accountantInvite}
                  setAccountantInvite={setAccountantInvite}
                  onBack={() => goToStep(2)}
                  onComplete={handleComplete}
                  loading={loading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
