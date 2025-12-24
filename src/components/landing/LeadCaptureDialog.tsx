import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const leadFormSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos').max(20, 'Telefone muito longo').optional().or(z.literal('')),
  company_name: z.string().max(100, 'Nome da empresa muito longo').optional().or(z.literal('')),
  role: z.string().max(50, 'Cargo muito longo').optional().or(z.literal('')),
  city: z.string().max(100, 'Cidade muito longa').optional().or(z.literal('')),
  state: z.string().max(2, 'Use a sigla do estado (ex: SP)').optional().or(z.literal('')),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar os Termos de Uso',
  }),
  privacy_accepted: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar a Política de Privacidade',
  }),
  marketing_accepted: z.boolean().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LeadCaptureDialog({ open, onOpenChange, onSuccess }: LeadCaptureDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      terms_accepted: false,
      privacy_accepted: false,
      marketing_accepted: false,
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      // Insert lead into database - include all required fields
      const { error: insertError } = await supabase.from('waitlist_leads').insert({
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
        terms_accepted: data.terms_accepted,
        privacy_accepted: data.privacy_accepted,
        marketing_accepted: data.marketing_accepted || false,
        consent_timestamp: new Date().toISOString(),
        source: 'demo_empresa_modelo',
        synced_to_sheets: false,
      });

      if (insertError) {
        console.error('Error inserting lead:', insertError);
        toast.error('Erro ao enviar seus dados. Tente novamente.');
        return;
      }

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
      }).catch((err) => {
        console.error('Error syncing to sheets:', err);
        // Non-blocking - lead is already saved to DB
      });

      toast.success('Obrigado pelo interesse! Entraremos em contato em breve.');
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting lead:', error);
      toast.error('Erro ao enviar seus dados. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Demo Empresa Modelo</DialogTitle>
          <DialogDescription>
            Preencha seus dados para acessar nossa demonstração com dados fictícios. Explore todas as funcionalidades do sistema.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome completo" {...field} />
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
                    <Input type="email" placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone / WhatsApp</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
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
                  <FormLabel>Nome da Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da sua empresa" {...field} />
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
                    <Input placeholder="Ex: Diretor Financeiro, CEO" {...field} />
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
                      <Input placeholder="São Paulo" {...field} />
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
                      <Input placeholder="SP" maxLength={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Seus dados serão utilizados exclusivamente para entrar em contato sobre nossos serviços, 
                conforme nossa política de privacidade.
              </p>

              <FormField
                control={form.control}
                name="terms_accepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">
                        Li e aceito os{' '}
                        <Link to="/terms" className="text-primary underline hover:no-underline" target="_blank">
                          Termos de Uso
                        </Link>{' '}
                        *
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="privacy_accepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal">
                        Li e aceito a{' '}
                        <Link to="/privacy-policy" className="text-primary underline hover:no-underline" target="_blank">
                          Política de Privacidade
                        </Link>{' '}
                        *
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

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
                      <FormLabel className="text-sm font-normal">
                        Aceito receber comunicações de marketing por e-mail (opcional)
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
                  Enviando...
                </>
              ) : (
                'Acessar Demo'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Campos marcados com * são obrigatórios. Você pode solicitar a exclusão dos seus dados a qualquer momento.
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
