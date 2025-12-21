import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Search, Check, ArrowRight, ArrowLeft, Loader2, Eye, Play } from 'lucide-react';
import { z } from 'zod';

const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos');

const DEMO_COMPANY_CNPJ = '12.345.678/0001-90';

interface CNPJData {
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

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const isDemoMode = searchParams.get('demo') === 'true';
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjData, setCnpjData] = useState<CNPJData | null>(null);
  const [demoCompany, setDemoCompany] = useState<{ id: string; company_name: string; nome_fantasia: string } | null>(null);
  const [demoError, setDemoError] = useState(false);
  
  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [address, setAddress] = useState('');
  const [taxRegime, setTaxRegime] = useState('SIMPLES');

  // Buscar empresa demo se estiver em modo demo
  useEffect(() => {
    if (isDemoMode) {
      fetchDemoCompany();
    }
  }, [isDemoMode]);

  const fetchDemoCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, company_name, nome_fantasia')
        .eq('cnpj', DEMO_COMPANY_CNPJ)
        .maybeSingle();

      if (error) {
        console.error('Error fetching demo company:', error);
        setDemoError(true);
        return;
      }

      if (!data) {
        console.error('Demo company not found');
        setDemoError(true);
        return;
      }

      setDemoCompany(data);
    } catch (error) {
      console.error('Error:', error);
      setDemoError(true);
    }
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setCnpjInput(formatted);
  };

  const consultarCNPJ = async () => {
    const cleanCNPJ = cnpjInput.replace(/\D/g, '');
    
    try {
      cnpjSchema.parse(cleanCNPJ);
    } catch {
      toast({
        title: 'CNPJ inválido',
        description: 'Digite um CNPJ válido com 14 dígitos',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: cleanCNPJ }
      });

      if (error) throw error;

      setCnpjData(data);
      setCompanyName(data.razaoSocial);
      setTradeName(data.nomeFantasia);
      setAddress(data.endereco);
      setTaxRegime(data.regimeTributario);
      setStep(2);

      toast({
        title: 'CNPJ encontrado!',
        description: 'Dados preenchidos automaticamente'
      });
    } catch (error: any) {
      console.error('Error fetching CNPJ:', error);
      toast({
        title: 'Erro ao consultar CNPJ',
        description: error.message || 'Tente novamente ou preencha manualmente',
        variant: 'destructive'
      });
      // Permitir preencher manualmente
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const joinDemoCompany = async () => {
    if (!demoCompany) {
      toast({
        title: 'Empresa demo não encontrada',
        description: 'Entre em contato com o suporte',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar se já está vinculado
      const { data: existingOrg } = await supabase
        .from('user_organizations')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', demoCompany.id)
        .single();

      if (existingOrg) {
        toast({
          title: 'Você já tem acesso!',
          description: 'Redirecionando para o dashboard...'
        });
        navigate('/dashboard');
        return;
      }

      // Vincular usuário à empresa demo
      const { error: orgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: demoCompany.id,
          is_default: true
        });

      if (orgError) throw orgError;

      // Criar role VIEWER para o usuário
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'VIEWER'
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Atualizar profile com company_id
      await supabase
        .from('profiles')
        .update({ company_id: demoCompany.id })
        .eq('id', user.id);

      toast({
        title: 'Acesso concedido!',
        description: 'Você agora pode visualizar a empresa demo'
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error joining demo company:', error);
      toast({
        title: 'Erro ao acessar empresa',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe a razão social da empresa',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const cleanCNPJ = cnpjInput.replace(/\D/g, '');

      // Criar company_settings
      const { data: company, error: companyError } = await supabase
        .from('company_settings')
        .insert({
          cnpj: cleanCNPJ,
          company_name: companyName,
          nome_fantasia: tradeName || companyName,
          address: address,
          tax_regime: taxRegime,
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Vincular usuário como ADMIN da organização
      const { error: orgError } = await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: company.id,
          is_default: true
        });

      if (orgError) throw orgError;

      // Criar role ADMIN para o usuário
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'ADMIN'
        });

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError;
      }

      // Atualizar profile com company_id
      await supabase
        .from('profiles')
        .update({ company_id: company.id })
        .eq('id', user.id);

      toast({
        title: 'Empresa criada com sucesso!',
        description: 'Você foi definido como administrador'
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: 'Erro ao criar empresa',
        description: error.message || 'Tente novamente',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isDemoMode ? 'Acessar Empresa Demo' : 'Cadastrar Nova Empresa'}
          </CardTitle>
          <CardDescription>
            {isDemoMode 
              ? 'Explore o sistema com dados fictícios'
              : step === 1 
              ? 'Digite o CNPJ para buscar os dados automaticamente'
              : step === 2 
              ? 'Confira os dados e ajuste se necessário'
              : 'Revise e confirme as informações'}
          </CardDescription>
          
          {/* Progress indicator - só mostra se não for demo */}
          {!isDemoMode && (
            <div className="flex justify-center gap-2 pt-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-12 rounded-full transition-colors ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Modo Demo - Card especial para acessar empresa demo */}
          {isDemoMode && demoCompany && (
            <div className="space-y-4">
              <div className="p-6 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Play className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{demoCompany.nome_fantasia || demoCompany.company_name}</h3>
                    <p className="text-sm text-muted-foreground">CNPJ: 12.345.678/0001-90</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="w-4 h-4" />
                  <span>Acesso somente leitura (VIEWER)</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  Você terá acesso a todos os dados da empresa para explorar as funcionalidades do sistema, 
                  sem poder fazer alterações.
                </p>

                <Button 
                  onClick={joinDemoCompany} 
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Acessando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Acessar Empresa Demo
                    </>
                  )}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => navigate('/onboarding')}
                className="w-full"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Criar Minha Própria Empresa
              </Button>
            </div>
          )}

          {/* Modo Demo carregando */}
          {isDemoMode && !demoCompany && !demoError && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Carregando empresa demo...</p>
            </div>
          )}

          {/* Modo Demo com erro */}
          {isDemoMode && demoError && (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive">Empresa demo não encontrada</p>
              <Button onClick={() => navigate('/onboarding')}>
                <Building2 className="w-4 h-4 mr-2" />
                Criar Minha Própria Empresa
              </Button>
            </div>
          )}

          {/* Fluxo normal de cadastro */}
          {!isDemoMode && step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ da Empresa</Label>
                <div className="flex gap-2">
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpjInput}
                    onChange={handleCNPJChange}
                    maxLength={18}
                    className="font-mono"
                  />
                  <Button onClick={consultarCNPJ} disabled={loading}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Consulta gratuita na base da Receita Federal
                </p>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                  Voltar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setStep(2)}
                  disabled={!cnpjInput}
                >
                  Preencher manualmente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {!isDemoMode && step === 2 && (
            <div className="space-y-4">
              {cnpjData && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Dados preenchidos via Receita Federal
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="companyName">Razão Social *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Empresa Ltda"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradeName">Nome Fantasia</Label>
                <Input
                  id="tradeName"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Minha Empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRegime">Regime Tributário</Label>
                <Select value={taxRegime} onValueChange={setTaxRegime}>
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

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={() => setStep(3)}>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {!isDemoMode && step === 3 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Resumo
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CNPJ:</span>
                    <span className="font-mono">{cnpjInput || 'Não informado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Razão Social:</span>
                    <span className="font-medium">{companyName}</span>
                  </div>
                  {tradeName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome Fantasia:</span>
                      <span>{tradeName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Regime:</span>
                    <span>{taxRegime}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                Você será definido como <strong>Administrador</strong> desta empresa.
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Criar Empresa
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
