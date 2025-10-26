import { z } from 'zod';

// Esquema de validação para autenticação
export const signUpSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(100, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
  fullName: z
    .string()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{10,14}$/, 'Telefone inválido (formato: +5511999999999)')
    .optional()
    .or(z.literal('')),
});

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Senha é obrigatória'),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
});

// Esquemas para transações financeiras
export const transactionSchema = z.object({
  description: z
    .string()
    .min(3, 'Descrição muito curta')
    .max(500, 'Descrição muito longa'),
  gross_amount: z
    .number()
    .positive('Valor deve ser positivo')
    .max(999999999, 'Valor muito alto'),
  due_date: z.date({
    required_error: 'Data de vencimento é obrigatória',
  }),
  category_id: z.string().uuid('Categoria inválida'),
});

// Esquema para configuração CFO
export const cfoConfigSchema = z.object({
  critical_cash_days_threshold: z
    .number()
    .int('Deve ser um número inteiro')
    .min(1, 'Mínimo 1 dia')
    .max(30, 'Máximo 30 dias'),
  warning_ar_overdue_percentage: z
    .number()
    .min(0, 'Percentual não pode ser negativo')
    .max(100, 'Percentual não pode exceder 100%'),
  warning_uncategorized_threshold: z
    .number()
    .int('Deve ser um número inteiro')
    .min(1, 'Mínimo 1 transação')
    .max(1000, 'Máximo 1000 transações'),
  notification_hour: z
    .number()
    .int('Deve ser um número inteiro')
    .min(0, 'Hora mínima: 0')
    .max(23, 'Hora máxima: 23'),
});

// Esquema para orçamento
export const budgetSchema = z.object({
  account_name: z
    .string()
    .min(2, 'Nome da conta muito curto')
    .max(100, 'Nome da conta muito longo'),
  account_category: z
    .string()
    .min(2, 'Categoria muito curta')
    .max(100, 'Categoria muito longa'),
  target_amount: z
    .number()
    .positive('Valor deve ser positivo')
    .max(999999999, 'Valor muito alto'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mês inválido (YYYY-MM)'),
});

// Tipos de retorno para validação
export type ValidationSuccess<T> = {
  success: true;
  data: T;
  errors?: never;
};

export type ValidationError = {
  success: false;
  data?: never;
  errors: Record<string, string>;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// Função helper para validar com feedback amigável
export function validateWithFeedback<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  result.error.errors.forEach((error) => {
    const path = error.path.join('.');
    errors[path] = error.message;
  });

  return { success: false, errors };
}
