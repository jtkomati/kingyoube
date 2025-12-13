/**
 * N8N Integration Architecture
 * 
 * This module provides the integration layer between the AI Agents and N8N workflows.
 * Each agent can trigger specific N8N workflows for automation tasks.
 * 
 * Architecture:
 * 1. Agent receives user request
 * 2. AI processes and determines if automation is needed
 * 3. If automation required, triggers N8N webhook
 * 4. N8N executes workflow and returns result
 * 5. Agent presents result to user
 */

export interface N8NWebhookPayload {
  agentId: string;
  action: string;
  data: Record<string, unknown>;
  userId?: string;
  companyId?: string;
}

export interface N8NWebhookResponse {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
}

export interface N8NWorkflowConfig {
  workflowId: string;
  webhookUrl: string;
  description: string;
  triggers: string[];
}

// Agent workflow mappings
export const agentWorkflows: Record<string, N8NWorkflowConfig> = {
  billing: {
    workflowId: 'billing-workflow',
    webhookUrl: '/webhook/billing',
    description: 'Automação de faturamento e emissão de NFs',
    triggers: ['emitir_nota', 'consultar_fatura', 'relatorio_vendas']
  },
  receivables: {
    workflowId: 'receivables-workflow',
    webhookUrl: '/webhook/receivables',
    description: 'Gestão de contas a receber',
    triggers: ['aging_report', 'enviar_lembrete', 'previsao_recebimento']
  },
  collection: {
    workflowId: 'collection-workflow',
    webhookUrl: '/webhook/collection',
    description: 'Automação de cobrança',
    triggers: ['enviar_cobranca', 'negociar_divida', 'relatorio_inadimplencia']
  },
  payables: {
    workflowId: 'payables-workflow',
    webhookUrl: '/webhook/payables',
    description: 'Gestão de contas a pagar',
    triggers: ['agendar_pagamento', 'aprovar_pagamento', 'relatorio_vencimentos']
  },
  treasury: {
    workflowId: 'treasury-workflow',
    webhookUrl: '/webhook/treasury',
    description: 'Gestão de tesouraria',
    triggers: ['posicao_caixa', 'conciliacao_bancaria', 'fluxo_caixa']
  },
  manager: {
    workflowId: 'manager-workflow',
    webhookUrl: '/webhook/manager',
    description: 'Orquestração de agentes',
    triggers: ['coordenar_agentes', 'relatorio_consolidado', 'dashboard_executivo']
  },
  cfo: {
    workflowId: 'cfo-workflow',
    webhookUrl: '/webhook/cfo',
    description: 'Planejamento financeiro estratégico',
    triggers: ['projecao_financeira', 'analise_cenarios', 'kpis_estrategicos']
  }
};

/**
 * Triggers an N8N workflow via webhook
 */
export async function triggerN8NWorkflow(
  n8nBaseUrl: string,
  agentId: string,
  payload: N8NWebhookPayload
): Promise<N8NWebhookResponse> {
  const workflow = agentWorkflows[agentId];
  
  if (!workflow) {
    return {
      success: false,
      error: `Workflow não encontrado para o agente: ${agentId}`
    };
  }

  try {
    const response = await fetch(`${n8nBaseUrl}${workflow.webhookUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`N8N returned status ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
      message: 'Workflow executado com sucesso'
    };
  } catch (error) {
    console.error('Error triggering N8N workflow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao executar workflow'
    };
  }
}

/**
 * Checks if a message should trigger an N8N workflow
 */
export function shouldTriggerWorkflow(agentId: string, message: string): string | null {
  const workflow = agentWorkflows[agentId];
  if (!workflow) return null;

  const lowerMessage = message.toLowerCase();
  
  // Check for trigger keywords
  for (const trigger of workflow.triggers) {
    const keywords = trigger.split('_');
    if (keywords.every(keyword => lowerMessage.includes(keyword))) {
      return trigger;
    }
  }

  return null;
}
