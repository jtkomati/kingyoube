import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  client_id: z.string().uuid(),
  period: z.enum(['last_30_days', 'last_90_days', 'last_year']).optional().default('last_30_days')
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, period } = validation.data;

    console.log(`Generating executive summary for client: ${client_id}, period: ${period}`);

    // Buscar informações do cliente
    const { data: company, error: companyError } = await supabase
      .from("company_settings")
      .select("*")
      .eq("id", client_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular datas do período
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);

    // Buscar transações do período
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .or(`customer_id.eq.${client_id},supplier_id.eq.${client_id}`)
      .gte("due_date", startDate.toISOString().split('T')[0]);

    if (txError) {
      console.error("Error fetching transactions:", txError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transactions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular métricas financeiras
    const receivables = (transactions || []).filter(t => t.type === 'RECEIVABLE');
    const payables = (transactions || []).filter(t => t.type === 'PAYABLE');
    
    const totalRevenue = receivables.reduce((sum, t) => sum + Number(t.gross_amount), 0);
    const totalExpenses = payables.reduce((sum, t) => sum + Number(t.gross_amount), 0);
    const netResult = totalRevenue - totalExpenses;
    
    const paidRevenue = receivables.filter(t => t.payment_date).reduce((sum, t) => sum + Number(t.net_amount), 0);
    const paidExpenses = payables.filter(t => t.payment_date).reduce((sum, t) => sum + Number(t.net_amount), 0);
    
    const overdueReceivables = receivables.filter(t => {
      if (t.payment_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate < today;
    });
    
    const overdueAmount = overdueReceivables.reduce((sum, t) => sum + Number(t.net_amount), 0);

    // Preparar prompt para a IA
    const financialData = {
      company_name: company.company_name,
      period: "Últimos 30 dias",
      total_revenue: Math.round(totalRevenue),
      total_expenses: Math.round(totalExpenses),
      net_result: Math.round(netResult),
      paid_revenue: Math.round(paidRevenue),
      paid_expenses: Math.round(paidExpenses),
      overdue_count: overdueReceivables.length,
      overdue_amount: Math.round(overdueAmount),
      transaction_count: (transactions || []).length,
    };

    const systemPrompt = `Você é um CFO experiente gerando um relatório executivo estratégico para apresentar ao cliente.

IMPORTANTE:
- Seja direto e objetivo
- Destaque insights acionáveis
- Use linguagem executiva e profissional
- Foque em tendências e riscos
- Sugira ações específicas
- NÃO use formatação markdown
- Formate os valores monetários sem o símbolo R$

Estruture o relatório assim:
1. RESUMO EXECUTIVO (2-3 parágrafos)
2. PRINCIPAIS INDICADORES
3. ANÁLISE DE TENDÊNCIAS
4. RISCOS IDENTIFICADOS
5. RECOMENDAÇÕES ESTRATÉGICAS`;

    const userPrompt = `Gere um relatório executivo baseado nestes dados financeiros:

Empresa: ${financialData.company_name}
Período: ${financialData.period}

Receitas Totais: ${financialData.total_revenue.toLocaleString('pt-BR')}
Despesas Totais: ${financialData.total_expenses.toLocaleString('pt-BR')}
Resultado Líquido: ${financialData.net_result.toLocaleString('pt-BR')}

Receitas Recebidas: ${financialData.paid_revenue.toLocaleString('pt-BR')}
Despesas Pagas: ${financialData.paid_expenses.toLocaleString('pt-BR')}

Contas a Receber Vencidas: ${financialData.overdue_count} transações totalizando ${financialData.overdue_amount.toLocaleString('pt-BR')}

Total de Transações: ${financialData.transaction_count}`;

    console.log("Calling Lovable AI for report generation...");

    // Chamar Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const reportText = aiData.choices[0]?.message?.content || "Erro ao gerar relatório";

    console.log("Executive summary generated successfully");

    return new Response(
      JSON.stringify({ 
        report_text: reportText,
        financial_data: financialData,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cfo-generate-executive-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
