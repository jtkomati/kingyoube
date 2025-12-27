import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashflow: number;
}

interface Projection {
  month: string;
  pessimistic: number;
  realistic: number;
  optimistic: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tentar pegar organization_id do body (nova abordagem)
    let companyId: string | null = null;
    
    try {
      const body = await req.json();
      if (body?.organization_id) {
        companyId = body.organization_id;
      }
    } catch {
      // Body pode ser vazio, ignorar
    }

    // Fallback para profiles.company_id se não passar organization_id
    if (!companyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        return new Response(JSON.stringify({ error: 'No company found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      companyId = profile.company_id;
    }

    // Fetch historical transactions (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .gte('due_date', twelveMonthsAgo.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return new Response(JSON.stringify({ error: 'Failed to fetch transactions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${transactions?.length || 0} transactions for analysis`);

    // Aggregate transactions by month
    const monthlyData: Record<string, MonthlyData> = {};
    
    for (const tx of transactions || []) {
      const date = new Date(tx.due_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          revenue: 0,
          expenses: 0,
          profit: 0,
          cashflow: 0,
        };
      }

      if (tx.type === 'RECEIVABLE') {
        monthlyData[monthKey].revenue += tx.net_amount || tx.gross_amount;
      } else {
        monthlyData[monthKey].expenses += tx.net_amount || tx.gross_amount;
      }
    }

    // Calculate profit and cashflow for each month
    const sortedMonths = Object.keys(monthlyData).sort();
    let accumulatedCashflow = 0;

    for (const month of sortedMonths) {
      monthlyData[month].profit = monthlyData[month].revenue - monthlyData[month].expenses;
      accumulatedCashflow += monthlyData[month].profit;
      monthlyData[month].cashflow = accumulatedCashflow;
    }

    const historicalData = sortedMonths.map(m => monthlyData[m]);

    // Use Lovable AI for intelligent predictions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let aiInsights: string[] = [];
    let aiProjections: any = null;

    if (LOVABLE_API_KEY && historicalData.length > 0) {
      try {
        const aiPrompt = `Você é um analista financeiro especializado em projeções. Analise os seguintes dados históricos mensais (em BRL) e forneça:

DADOS HISTÓRICOS:
${JSON.stringify(historicalData, null, 2)}

Por favor, responda em formato JSON válido com a seguinte estrutura:
{
  "revenueProjections": [
    { "month": "YYYY-MM", "pessimistic": number, "realistic": number, "optimistic": number }
  ],
  "plProjections": [
    { "month": "YYYY-MM", "pessimistic": number, "realistic": number, "optimistic": number }
  ],
  "cashflowProjections": [
    { "month": "YYYY-MM", "pessimistic": number, "realistic": number, "optimistic": number }
  ],
  "insights": [
    "insight 1 em português",
    "insight 2 em português",
    "insight 3 em português"
  ],
  "confidenceScore": number (0-100),
  "alerts": [
    "alerta 1 se houver risco",
    "alerta 2 se houver risco"
  ]
}

Gere projeções para os próximos 6 meses a partir de agora. Use análise de tendência, sazonalidade e crescimento histórico. O cenário pessimista deve ser -15% do realista, e otimista +20%.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um analista financeiro expert em projeções. Sempre responda em JSON válido.' },
              { role: 'user', content: aiPrompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiProjections = JSON.parse(jsonMatch[0]);
              aiInsights = aiProjections.insights || [];
              console.log('AI projections generated successfully');
            }
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
      }
    }

    // Generate fallback projections if AI didn't work
    if (!aiProjections) {
      console.log('Using fallback statistical projections');
      
      // Se não há dados históricos, retornar resposta vazia
      if (historicalData.length === 0) {
        console.log('No historical data - returning empty response');
        return new Response(JSON.stringify({
          historical: [],
          projections: { revenue: [], pl: [], cashflow: [] },
          kpis: {
            sixMonthRevenue: 0,
            sixMonthProfit: 0,
            projectedCashBalance: 0,
            profitMargin: 0,
            confidenceScore: 0,
          },
          insights: ['Adicione transações para gerar projeções preditivas'],
          alerts: [],
          generatedAt: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Usar dados históricos reais para projeções
      const avgRevenue = historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length;
      const avgExpenses = historicalData.reduce((sum, d) => sum + d.expenses, 0) / historicalData.length;
      const baseCashflow = historicalData[historicalData.length - 1]?.cashflow || 0;
      
      // Calculate trend (simple linear regression)
      let revenueSlope = 0;
      if (historicalData.length >= 2) {
        const n = historicalData.length;
        const lastRevenue = historicalData[n - 1]?.revenue || avgRevenue;
        const firstRevenue = historicalData[0]?.revenue || avgRevenue;
        revenueSlope = (lastRevenue - firstRevenue) / n;
      }

      const avgProfit = avgRevenue - avgExpenses;

      const revenueProjections: Projection[] = [];
      const plProjections: Projection[] = [];
      const cashflowProjections: Projection[] = [];

      const now = new Date();
      let projectedCashflow = baseCashflow;

      for (let i = 1; i <= 6; i++) {
        const futureDate = new Date(now);
        futureDate.setMonth(futureDate.getMonth() + i);
        const monthKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

        const projectedRevenue = avgRevenue + (revenueSlope * i);
        const projectedProfit = projectedRevenue - avgExpenses;
        projectedCashflow += projectedProfit;

        revenueProjections.push({
          month: monthKey,
          pessimistic: Math.round(projectedRevenue * 0.85),
          realistic: Math.round(projectedRevenue),
          optimistic: Math.round(projectedRevenue * 1.2),
        });

        plProjections.push({
          month: monthKey,
          pessimistic: Math.round(projectedProfit * 0.85),
          realistic: Math.round(projectedProfit),
          optimistic: Math.round(projectedProfit * 1.2),
        });

        cashflowProjections.push({
          month: monthKey,
          pessimistic: Math.round(projectedCashflow * 0.85),
          realistic: Math.round(projectedCashflow),
          optimistic: Math.round(projectedCashflow * 1.2),
        });
      }

      aiProjections = {
        revenueProjections,
        plProjections,
        cashflowProjections,
        confidenceScore: 65,
        alerts: projectedCashflow < 0 ? ['Projeção indica possível saldo negativo nos próximos meses'] : [],
      };

      aiInsights = [
        `Receita média mensal: R$ ${avgRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Despesa média mensal: R$ ${avgExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `Tendência de crescimento: ${revenueSlope > 0 ? 'Positiva' : revenueSlope < 0 ? 'Negativa' : 'Estável'}`,
      ];
    }

    // Calculate summary KPIs
    const sixMonthRevenue = (aiProjections.revenueProjections || [])
      .reduce((sum: number, p: Projection) => sum + p.realistic, 0);
    const sixMonthProfit = (aiProjections.plProjections || [])
      .reduce((sum: number, p: Projection) => sum + p.realistic, 0);
    const projectedCashBalance = aiProjections.cashflowProjections?.slice(-1)[0]?.realistic || 0;

    const response = {
      historical: historicalData,
      projections: {
        revenue: aiProjections.revenueProjections || [],
        pl: aiProjections.plProjections || [],
        cashflow: aiProjections.cashflowProjections || [],
      },
      kpis: {
        sixMonthRevenue,
        sixMonthProfit,
        projectedCashBalance,
        profitMargin: sixMonthRevenue > 0 ? (sixMonthProfit / sixMonthRevenue) * 100 : 0,
        confidenceScore: aiProjections.confidenceScore || 65,
      },
      insights: aiInsights,
      alerts: aiProjections.alerts || [],
      generatedAt: new Date().toISOString(),
    };

    console.log('Predictive analytics response generated successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Predictive analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
