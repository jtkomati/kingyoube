import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';

// Schema simplificado - apenas nome e email obrigatórios
const leadFormSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  phone: z.string().max(20, 'Telefone muito longo').optional().or(z.literal('')),
  company_name: z.string().max(100, 'Nome da empresa muito longo').optional().or(z.literal('')),
  role: z.string().max(50, 'Cargo muito longo').optional().or(z.literal('')),
  city: z.string().max(100, 'Cidade muito longa').optional().or(z.literal('')),
  state: z.string().max(10, 'Estado muito longo').optional().or(z.literal('')),
  marketing_accepted: z.boolean().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Gerar session ID único para tracking
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Função para enviar eventos de analytics
const trackFormEvent = async (
  eventType: 'form_opened' | 'field_completed' | 'submitted' | 'error',
  formName: string,
  fieldName?: string,
  metadata?: Record<string, unknown>,
  sessionId?: string
) => {
  const eventData = {
    event_type: eventType,
    form_name: formName,
    field_name: fieldName || null,
    metadata: metadata || {},
    session_id: sessionId || null,
    user_agent: navigator.userAgent,
  };

  // Log para console (debugging)
  console.log(`📊 [Analytics] ${eventType}:`, eventData);

  // Enviar para banco de dados (non-blocking)
  try {
    // @ts-expect-error - form_analytics table not yet in generated types
    const { error } = await supabase.from('form_analytics').insert([eventData]);
    if (error) {
      console.warn('⚠️ Failed to track event:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ Analytics error:', err);
  }
};

export function LeadCaptureDialog({ open, onOpenChange, onSuccess }: LeadCaptureDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      company_name: '',
      role: '',
      city: '',
      state: '',
      marketing_accepted: false,
    },
  });

  // FASE 1: Track form opened
  useEffect(() => {
    if (open) {
      trackFormEvent('form_opened', 'lead_capture', undefined, { timestamp: new Date().toISOString() }, sessionId);
    }
  }, [open, sessionId]);

  // FASE 1: Track field completion
  const handleFieldBlur = useCallback((fieldName: string, value: string) => {
    if (value && value.trim() !== '' && !completedFields.has(fieldName)) {
      setCompletedFields(prev => new Set(prev).add(fieldName));
      trackFormEvent('field_completed', 'lead_capture', fieldName, { 
        fieldsCompleted: completedFields.size + 1,
        timestamp: new Date().toISOString()
      }, sessionId);
    }
  }, [completedFields, sessionId]);

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    
    // FASE 2: Log detalhado antes do insert
    console.log('📝 [LeadCapture] Attempting to insert lead:', {
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || '(não informado)',
      company_name: data.company_name || '(não informado)',
      role: data.role || '(não informado)',
      city: data.city || '(não informado)',
      state: data.state || '(não informado)',
      marketing_accepted: data.marketing_accepted,
    });

    try {
      const insertData = {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        company: data.company_name || 'Não informado',
        company_name: data.company_name || null,
        job_title: data.role || 'Não informado',
        role: data.role || null,
        city: data.city || 'Não informado',
        state: data.state || 'XX',
        selected_plan: 'demo_empresa_modelo',
        terms_accepted: true, // Implícito ao submeter
        privacy_accepted: true, // Implícito ao submeter
        marketing_accepted: data.marketing_accepted || false,
        consent_timestamp: new Date().toISOString(),
        source: 'demo_empresa_modelo',
        synced_to_sheets: false,
      };

      console.log('📤 [LeadCapture] Insert data:', insertData);

      const { data: insertedData, error: insertError } = await supabase
        .from('waitlist_leads')
        .insert(insertData)
        .select();

      if (insertError) {
        // FASE 2: Log detalhado de erro
        console.error('❌ [LeadCapture] Insert error:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        });
        
        // FASE 1: Track error event
        trackFormEvent('error', 'lead_capture', undefined, {
          errorCode: insertError.code,
          errorMessage: insertError.message,
          timestamp: new Date().toISOString(),
        }, sessionId);

        // FASE 2: Toast com erro específico
        if (insertError.code === '23505') {
          toast.error('Este email já está cadastrado. Use outro email ou entre em contato conosco.');
        } else if (insertError.code === '42501') {
          toast.error('Erro de permissão. Por favor, tente novamente mais tarde.');
        } else {
          toast.error(`Erro ao enviar dados: ${insertError.message}`);
        }
        return;
      }

      // FASE 2: Log de sucesso
      console.log('✅ [LeadCapture] Lead inserted successfully:', insertedData);

      // FASE 1: Track success event
      trackFormEvent('submitted', 'lead_capture', undefined, {
        fieldsCompleted: completedFields.size,
        hasPhone: !!data.phone,
        hasCompany: !!data.company_name,
        marketingAccepted: data.marketing_accepted,
        timestamp: new Date().toISOString(),
      }, sessionId);

      // Sync to Google Sheets in background
      supabase.functions.invoke('sync-leads-to-sheets', {
        body: {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone || '',
          company_name: data.company_name || '',
          role: data.role || '',
          city: data.city || '',
          state: data.state || '',
          marketing_accepted: data.marketing_accepted || false,
        },
      }).then(response => {
        console.log('📊 [LeadCapture] Sheets sync response:', response);
      }).catch((err) => {
        console.warn('⚠️ [LeadCapture] Sheets sync error (non-blocking):', err);
      });

      toast.success('Obrigado pelo interesse! Você será redirecionado para a demo.');
      form.reset();
      setCompletedFields(new Set());
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // FASE 2: Log de exceção
      console.error('💥 [LeadCapture] Unexpected error:', error);
      
      trackFormEvent('error', 'lead_capture', undefined, {
        errorType: 'exception',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }, sessionId);

      toast.error('Erro inesperado. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // FASE 2: Log de erros de validação
  const onFormError = (errors: Record<string, unknown>) => {
    console.warn('⚠️ [LeadCapture] Validation errors:', errors);
    trackFormEvent('error', 'lead_capture', undefined, {
      errorType: 'validation',
      errors: Object.keys(errors),
      timestamp: new Date().toISOString(),
    }, sessionId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Demo Empresa Modelo</DialogTitle>
          <DialogDescription>
            Preencha seus dados para acessar nossa demonstração. Explore todas as funcionalidades do sistema.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-4">
            {/* Campos obrigatórios (sempre visíveis) */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Seu nome" 
                      {...field} 
                      onBlur={(e) => {
                        field.onBlur();
                        handleFieldBlur('full_name', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="seu@email.com" 
                      {...field}
                      onBlur={(e) => {
                        field.onBlur();
                        handleFieldBlur('email', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* FASE 3: Campos opcionais colapsáveis */}
            <Collapsible open={showMoreFields} onOpenChange={setShowMoreFields}>
              <CollapsibleTrigger asChild>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  {showMoreFields ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Ocultar campos adicionais
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Adicionar mais informações (opcional)
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="(11) 99999-9999" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur('phone', e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nome da sua empresa" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur('company_name', e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Diretor Financeiro" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            handleFieldBlur('role', e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="São Paulo" 
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              handleFieldBlur('city', e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="SP" 
                            {...field}
                            onBlur={(e) => {
                              field.onBlur();
                              handleFieldBlur('state', e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* FASE 3: Apenas checkbox de marketing (opcional) */}
            <div className="space-y-3 pt-2">
              <FormField
                control={form.control}
                name="marketing_accepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal text-muted-foreground">
                        Aceito receber novidades e dicas por e-mail
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Acessar Demo'
              )}
            </Button>

            {/* FASE 3: Texto de termos implícitos */}
            <p className="text-xs text-muted-foreground text-center">
              Ao clicar em "Acessar Demo", você concorda com nossos{' '}
              <Link to="/terms" className="text-primary underline hover:no-underline" target="_blank">
                Termos de Uso
              </Link>{' '}
              e{' '}
              <Link to="/privacy-policy" className="text-primary underline hover:no-underline" target="_blank">
                Política de Privacidade
              </Link>.
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
