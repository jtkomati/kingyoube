import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { AccountantInvite } from './OnboardingModal';

const emailSchema = z.string().email('Email inválido');
const crcSchema = z.string().min(5, 'CRC inválido').max(15, 'CRC inválido');

interface OnboardingStep3Props {
  accountantInvite: AccountantInvite | null;
  setAccountantInvite: (invite: AccountantInvite | null) => void;
  onBack: () => void;
  onComplete: () => void;
  loading: boolean;
}

export function OnboardingStep3({ 
  accountantInvite, 
  setAccountantInvite, 
  onBack, 
  onComplete, 
  loading 
}: OnboardingStep3Props) {
  const [wantsAccountant, setWantsAccountant] = useState(false);
  const [email, setEmail] = useState(accountantInvite?.email || '');
  const [crc, setCrc] = useState(accountantInvite?.crc || '');
  const [errors, setErrors] = useState<{ email?: string; crc?: string }>({});

  const handleWantsAccountantChange = (checked: boolean) => {
    setWantsAccountant(checked);
    if (!checked) {
      setAccountantInvite(null);
      setEmail('');
      setCrc('');
      setErrors({});
    }
  };

  const validateAndProceed = () => {
    if (!wantsAccountant) {
      setAccountantInvite(null);
      onComplete();
      return;
    }

    const newErrors: { email?: string; crc?: string } = {};

    try {
      emailSchema.parse(email);
    } catch {
      newErrors.email = 'Email inválido';
    }

    try {
      crcSchema.parse(crc);
    } catch {
      newErrors.crc = 'CRC inválido (ex: SP-123456)';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setAccountantInvite({ email, crc });
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Acesso do Contador</h2>
        <p className="text-sm text-muted-foreground">
          Vamos convidar seu contador para facilitar sua vida?
        </p>
      </div>

      {/* Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-4 rounded-xl border border-border"
      >
        <Checkbox
          id="wantsAccountant"
          checked={wantsAccountant}
          onCheckedChange={handleWantsAccountantChange}
        />
        <Label htmlFor="wantsAccountant" className="cursor-pointer flex-1">
          <span className="font-medium">Sim, quero convidar meu contador</span>
          <span className="block text-xs text-muted-foreground mt-1">
            Ele receberá um email de convite com acesso à empresa
          </span>
        </Label>
      </motion.div>

      {/* Accountant Form */}
      {wantsAccountant && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="accountantEmail">Email do Contador</Label>
            <Input
              id="accountantEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contador@escritorio.com.br"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="crc">CRC (Registro no Conselho)</Label>
            <Input
              id="crc"
              value={crc}
              onChange={(e) => setCrc(e.target.value.toUpperCase())}
              placeholder="SP-123456"
              className={errors.crc ? 'border-destructive' : ''}
            />
            {errors.crc && (
              <p className="text-xs text-destructive">{errors.crc}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Skip info */}
      {!wantsAccountant && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-center text-muted-foreground"
        >
          Você pode convidar seu contador depois nas configurações
        </motion.p>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={validateAndProceed}
            disabled={loading}
            className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Finalizar e Ver Mágica
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
