export interface BusinessRule {
  id: string;
  rule_name: string;
  description: string;
  context: string;
  logic: Record<string, any>;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type BusinessRuleContext = 
  | 'financeiro' 
  | 'faturamento' 
  | 'tesouraria' 
  | 'compras' 
  | 'cobranca'
  | 'contabilidade';

export interface BusinessRuleFormData {
  rule_name: string;
  description: string;
  context: string;
  logic: Record<string, any>;
  is_active: boolean;
}

export const RULE_CONTEXTS = [
  { value: 'financeiro', labelKey: 'financeiro' },
  { value: 'faturamento', labelKey: 'faturamento' },
  { value: 'tesouraria', labelKey: 'tesouraria' },
  { value: 'compras', labelKey: 'compras' },
  { value: 'cobranca', labelKey: 'cobranca' },
  { value: 'contabilidade', labelKey: 'contabilidade' },
] as const;
