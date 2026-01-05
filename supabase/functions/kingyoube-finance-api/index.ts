import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Categorias disponíveis para consulta
type Categoria = 'dashboard' | 'relatorios' | 'preditivo' | 'notas_fiscais' | 'contas_pagar' | 'contas_receber' | 'agentes';
type Periodo = 'hoje' | 'semana' | 'mes_atual' | 'trimestre' | 'ano';

interface RequestBody {
  phone_number: string;
  categoria: Categoria;
  periodo?: Periodo;
  detalhes?: {
    subconsulta?: string;
    limite?: number;
  };
}

// Timing-safe string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Calcular datas baseado no período
function getDateRange(periodo: Periodo): { startDate: Date; endDate: Date } {
  const now = new Date();
  let endDate = new Date(now);
  let startDate = new Date(now);

  switch (periodo) {
    case 'hoje':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'semana':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'mes_atual':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'trimestre':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'ano':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return { startDate, endDate };
}

// Formatar valor em BRL
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verificar API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('N8N_API_KEY');

    if (!apiKey || !expectedKey || !timingSafeEqual(apiKey, expectedKey)) {
      console.error('API Key inválida ou ausente');
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse body
    const body: RequestBody = await req.json();
    const { phone_number, categoria, periodo = 'mes_atual', detalhes } = body;

    // 3. Validar campos obrigatórios
    if (!phone_number || !categoria) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'phone_number e categoria são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validCategorias: Categoria[] = ['dashboard', 'relatorios', 'preditivo', 'notas_fiscais', 'contas_pagar', 'contas_receber', 'agentes'];
    if (!validCategorias.includes(categoria)) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: `Categoria inválida. Use: ${validCategorias.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Buscar usuário pelo telefone
    const normalizedPhone = phone_number.replace(/\D/g, '');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone_number, company_id, whatsapp_enabled')
      .or(`phone_number.eq.${phone_number},phone_number.eq.+${normalizedPhone},phone_number.eq.${normalizedPhone}`)
      .single();

    if (profileError || !profile) {
      console.log('Usuário não encontrado para telefone:', phone_number);
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Número não cadastrado no sistema. Por favor, solicite ao administrador que cadastre seu número.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verificar se WhatsApp está habilitado
    if (!profile.whatsapp_enabled) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Acesso WhatsApp não autorizado para este usuário. Solicite habilitação ao administrador.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = profile.company_id;
    if (!companyId) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: 'Usuário não vinculado a nenhuma empresa.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Buscar nome da empresa
    const { data: company } = await supabase
      .from('organizations')
      .select('company_name')
      .eq('id', companyId)
      .single();

    const companyName = company?.company_name || 'Empresa';
    const { startDate, endDate } = getDateRange(periodo);

    // 8. Processar categoria
    let resultado: any = {};

    switch (categoria) {
      case 'dashboard': {
        // Métricas de Startup
        const { data: receivables } = await supabase
          .from('transactions')
          .select('net_amount')
          .eq('company_id', companyId)
          .eq('type', 'RECEIVABLE')
          .gte('due_date', startDate.toISOString())
          .lte('due_date', endDate.toISOString());

        const { data: payables } = await supabase
          .from('transactions')
          .select('net_amount')
          .eq('company_id', companyId)
          .eq('type', 'PAYABLE')
          .gte('due_date', startDate.toISOString())
          .lte('due_date', endDate.toISOString());

        const { data: customers } = await supabase
          .from('customers')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true);

        const totalReceivables = receivables?.reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const totalPayables = payables?.reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const netBalance = totalReceivables - totalPayables;
        const totalCustomers = customers?.length || 0;
        const mrr = totalReceivables; // Simplificado
        const arr = mrr * 12;
        const burnRate = totalPayables > totalReceivables ? totalPayables - totalReceivables : 0;

        resultado = {
          tipo: 'dashboard',
          periodo,
          resumo: `MRR: ${formatBRL(mrr)}. Saldo líquido: ${formatBRL(netBalance)}. Total de clientes ativos: ${totalCustomers}.`,
          dados: {
            mrr,
            arr,
            total_receitas: totalReceivables,
            total_despesas: totalPayables,
            saldo_liquido: netBalance,
            total_clientes: totalCustomers,
            burn_rate: burnRate,
          },
          alertas: netBalance < 0 ? ['⚠️ Atenção: Saldo líquido negativo no período!'] : [],
        };
        break;
      }

      case 'relatorios': {
        // DRE / Fluxo de Caixa
        const { data: transactions } = await supabase
          .from('transactions')
          .select('type, net_amount, category_id, payment_date')
          .eq('company_id', companyId)
          .gte('due_date', startDate.toISOString())
          .lte('due_date', endDate.toISOString());

        const receitas = transactions?.filter(t => t.type === 'RECEIVABLE').reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const despesas = transactions?.filter(t => t.type === 'PAYABLE').reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const recebido = transactions?.filter(t => t.type === 'RECEIVABLE' && t.payment_date).reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const pago = transactions?.filter(t => t.type === 'PAYABLE' && t.payment_date).reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;

        resultado = {
          tipo: 'relatorios',
          periodo,
          resumo: `Receita: ${formatBRL(receitas)} | Despesas: ${formatBRL(despesas)} | Lucro: ${formatBRL(receitas - despesas)}`,
          dados: {
            receita_bruta: receitas,
            despesas_totais: despesas,
            lucro_liquido: receitas - despesas,
            margem_percentual: receitas > 0 ? ((receitas - despesas) / receitas * 100).toFixed(1) : 0,
            recebido: recebido,
            pago: pago,
            a_receber: receitas - recebido,
            a_pagar: despesas - pago,
          },
          alertas: [],
        };
        break;
      }

      case 'preditivo': {
        // Análise preditiva simplificada
        const { data: historico } = await supabase
          .from('transactions')
          .select('net_amount, type, due_date')
          .eq('company_id', companyId)
          .gte('due_date', new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString())
          .order('due_date', { ascending: true });

        const totalHist = historico?.filter(t => t.type === 'RECEIVABLE').reduce((sum, t) => sum + (t.net_amount || 0), 0) || 0;
        const mediaReceita = totalHist / 6;
        const projecao6M = mediaReceita * 6;

        resultado = {
          tipo: 'preditivo',
          periodo: '6_meses',
          resumo: `Projeção de receita para os próximos 6 meses: ${formatBRL(projecao6M)}. Média mensal histórica: ${formatBRL(mediaReceita)}.`,
          dados: {
            media_mensal: mediaReceita,
            projecao_6_meses: projecao6M,
            tendencia: mediaReceita > 0 ? 'estável' : 'baixa',
          },
          alertas: mediaReceita === 0 ? ['⚠️ Poucos dados históricos para projeção confiável.'] : [],
        };
        break;
      }

      case 'notas_fiscais': {
        // Notas fiscais
        const { data: nfse } = await supabase
          .from('transactions')
          .select('id, description, net_amount, invoice_number, invoice_status, due_date')
          .eq('company_id', companyId)
          .not('invoice_number', 'is', null)
          .gte('due_date', startDate.toISOString())
          .lte('due_date', endDate.toISOString())
          .order('due_date', { ascending: false })
          .limit(detalhes?.limite || 5);

        const totalEmitidas = nfse?.filter(n => n.invoice_status === 'issued').length || 0;
        const totalPendentes = nfse?.filter(n => n.invoice_status === 'pending').length || 0;
        const valorTotal = nfse?.reduce((sum, n) => sum + (n.net_amount || 0), 0) || 0;

        resultado = {
          tipo: 'notas_fiscais',
          periodo,
          resumo: `${totalEmitidas} notas emitidas, ${totalPendentes} pendentes. Valor total: ${formatBRL(valorTotal)}.`,
          dados: {
            total_emitidas: totalEmitidas,
            total_pendentes: totalPendentes,
            valor_total: valorTotal,
            ultimas_notas: nfse?.slice(0, 5).map(n => ({
              numero: n.invoice_number,
              descricao: n.description,
              valor: n.net_amount,
              status: n.invoice_status,
              data: n.due_date,
            })) || [],
          },
          alertas: totalPendentes > 0 ? [`📋 Você tem ${totalPendentes} nota(s) pendente(s) de emissão.`] : [],
        };
        break;
      }

      case 'contas_pagar': {
        // Contas a pagar
        const { data: payables } = await supabase
          .from('transactions')
          .select('id, description, net_amount, due_date, payment_date, supplier_id')
          .eq('company_id', companyId)
          .eq('type', 'PAYABLE')
          .is('payment_date', null)
          .order('due_date', { ascending: true })
          .limit(detalhes?.limite || 10);

        const hoje = new Date();
        const atrasadas = payables?.filter(p => new Date(p.due_date) < hoje) || [];
        const proximas = payables?.filter(p => new Date(p.due_date) >= hoje).slice(0, 5) || [];
        const totalPendente = payables?.reduce((sum, p) => sum + (p.net_amount || 0), 0) || 0;
        const totalAtrasado = atrasadas.reduce((sum, p) => sum + (p.net_amount || 0), 0);

        resultado = {
          tipo: 'contas_pagar',
          periodo,
          resumo: `Total a pagar: ${formatBRL(totalPendente)}. Em atraso: ${formatBRL(totalAtrasado)} (${atrasadas.length} conta${atrasadas.length !== 1 ? 's' : ''}).`,
          dados: {
            total_pendente: totalPendente,
            total_atrasado: totalAtrasado,
            quantidade_atrasadas: atrasadas.length,
            proximos_vencimentos: proximas.map(p => ({
              descricao: p.description,
              valor: p.net_amount,
              vencimento: p.due_date,
            })),
          },
          alertas: atrasadas.length > 0 ? [`🚨 Você tem ${atrasadas.length} conta(s) em atraso!`] : [],
        };
        break;
      }

      case 'contas_receber': {
        // Contas a receber
        const { data: receivables } = await supabase
          .from('transactions')
          .select('id, description, net_amount, due_date, payment_date, customer_id')
          .eq('company_id', companyId)
          .eq('type', 'RECEIVABLE')
          .is('payment_date', null)
          .order('due_date', { ascending: true })
          .limit(detalhes?.limite || 10);

        const hoje = new Date();
        const atrasadas = receivables?.filter(r => new Date(r.due_date) < hoje) || [];
        const proximas = receivables?.filter(r => new Date(r.due_date) >= hoje).slice(0, 5) || [];
        const totalReceber = receivables?.reduce((sum, r) => sum + (r.net_amount || 0), 0) || 0;
        const totalAtrasado = atrasadas.reduce((sum, r) => sum + (r.net_amount || 0), 0);

        resultado = {
          tipo: 'contas_receber',
          periodo,
          resumo: `Total a receber: ${formatBRL(totalReceber)}. Em atraso: ${formatBRL(totalAtrasado)} (${atrasadas.length} recebível${atrasadas.length !== 1 ? 'is' : ''}).`,
          dados: {
            total_receber: totalReceber,
            total_atrasado: totalAtrasado,
            quantidade_atrasadas: atrasadas.length,
            proximos_recebimentos: proximas.map(r => ({
              descricao: r.description,
              valor: r.net_amount,
              vencimento: r.due_date,
            })),
          },
          alertas: atrasadas.length > 0 ? [`📞 ${atrasadas.length} cliente(s) com pagamento atrasado.`] : [],
        };
        break;
      }

      case 'agentes': {
        // Status dos agentes e aprovações
        const { data: approvals } = await supabase
          .from('approval_queue')
          .select('id, agent_id, action_type, status, priority, created_at')
          .eq('company_id', companyId)
          .eq('status', 'pending')
          .order('priority', { ascending: true })
          .limit(10);

        const { data: workflows } = await supabase
          .from('workflow_instances')
          .select('id, workflow_id, current_state, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5);

        const pendentes = approvals?.length || 0;
        const urgentes = approvals?.filter(a => a.priority <= 3).length || 0;

        resultado = {
          tipo: 'agentes',
          periodo,
          resumo: `${pendentes} aprovação(ões) pendente(s)${urgentes > 0 ? `, sendo ${urgentes} urgente(s)` : ''}.`,
          dados: {
            total_pendentes: pendentes,
            urgentes: urgentes,
            aprovacoes_pendentes: approvals?.map(a => ({
              agente: a.agent_id,
              acao: a.action_type,
              prioridade: a.priority,
              data: a.created_at,
            })) || [],
            ultimos_workflows: workflows?.map(w => ({
              workflow_id: w.workflow_id,
              estado: w.current_state,
              data: w.created_at,
            })) || [],
          },
          alertas: urgentes > 0 ? [`⚡ ${urgentes} aprovação(ões) urgente(s) aguardando sua decisão!`] : [],
        };
        break;
      }
    }

    // 9. Montar resposta final
    const response = {
      sucesso: true,
      usuario: profile.full_name,
      empresa: companyName,
      ...resultado,
      timestamp: new Date().toISOString(),
    };

    console.log(`Consulta ${categoria} para ${profile.full_name} (${phone_number}) concluída`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na API:', error);
    return new Response(
      JSON.stringify({ sucesso: false, erro: 'Erro interno do servidor. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
