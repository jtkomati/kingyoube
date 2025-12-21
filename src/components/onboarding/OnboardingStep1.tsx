import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Check, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { CompanyFormData, CNPJData } from './OnboardingModal';

const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos');

interface OnboardingStep1Props {
  companyData: CompanyFormData;
  setCompanyData: (data: CompanyFormData) => void;
  onNext: () => void;
}

export function OnboardingStep1({ companyData, setCompanyData, onNext }: OnboardingStep1Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cnpjData, setCnpjData] = useState<CNPJData | null>(null);
  const [showForm, setShowForm] = useState(false);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const consultarCNPJ = useCallback(async (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    try {
      cnpjSchema.parse(cleanCNPJ);
    } catch {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: cleanCNPJ }
      });

      if (error) throw error;

      setCnpjData(data);
      setCompanyData({
        ...companyData,
        cnpj: cleanCNPJ,
        companyName: data.razaoSocial,
        tradeName: data.nomeFantasia,
        address: data.endereco,
        taxRegime: data.regimeTributario
      });
      setShowForm(true);

      toast({
        title: 'CNPJ encontrado!',
        description: 'Dados preenchidos automaticamente'
      });
    } catch (error: any) {
      console.error('Error fetching CNPJ:', error);
      toast({
        title: 'CNPJ não encontrado',
        description: 'Preencha os dados manualmente',
        variant: 'destructive'
      });
      setShowForm(true);
      setCompanyData({
        ...companyData,
        cnpj: cleanCNPJ
      });
    } finally {
      setLoading(false);
    }
  }, [companyData, setCompanyData, toast]);

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setCompanyData({ ...companyData, cnpj: formatted });
    
    // Auto-consulta ao 14º dígito
    const cleanCNPJ = formatted.replace(/\D/g, '');
    if (cleanCNPJ.length === 14) {
      consultarCNPJ(formatted);
    }
  };

  const handleConfirm = () => {
    if (!companyData.companyName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a razão social da empresa',
        variant: 'destructive'
      });
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Identidade Instantânea</h2>
        <p className="text-sm text-muted-foreground">
          Digite o CNPJ e preenchemos tudo automaticamente
        </p>
      </div>

      {/* CNPJ Input */}
      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ da Empresa</Label>
        <Input
          id="cnpj"
          placeholder="00.000.000/0000-00"
          value={companyData.cnpj}
          onChange={handleCNPJChange}
          maxLength={18}
          className="font-mono text-center text-lg h-12"
          autoFocus
        />
        <p className="text-xs text-muted-foreground text-center">
          Consulta automática na Receita Federal
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}

      {/* Company Data Card */}
      {cnpjData && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3"
        >
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Check className="w-4 h-4" />
            Empresa encontrada
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{cnpjData.razaoSocial}</p>
            {cnpjData.nomeFantasia && (
              <p className="text-muted-foreground">{cnpjData.nomeFantasia}</p>
            )}
            <p className="text-muted-foreground text-xs">{cnpjData.endereco}</p>
          </div>
        </motion.div>
      )}

      {/* Manual Form */}
      {showForm && !loading && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="companyName">Razão Social *</Label>
            <Input
              id="companyName"
              value={companyData.companyName}
              onChange={(e) => setCompanyData({ ...companyData, companyName: e.target.value })}
              placeholder="Empresa Ltda"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tradeName">Nome Fantasia</Label>
            <Input
              id="tradeName"
              value={companyData.tradeName}
              onChange={(e) => setCompanyData({ ...companyData, tradeName: e.target.value })}
              placeholder="Minha Empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxRegime">Regime Tributário</Label>
            <Select 
              value={companyData.taxRegime} 
              onValueChange={(value) => setCompanyData({ ...companyData, taxRegime: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => setShowForm(true)}
          disabled={loading || showForm}
          className="text-muted-foreground"
        >
          Preencher manualmente
        </Button>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: showForm ? 1 : 0.5, scale: 1 }}
        >
          <Button
            onClick={handleConfirm}
            disabled={loading || !showForm}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Confirmar Empresa
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
