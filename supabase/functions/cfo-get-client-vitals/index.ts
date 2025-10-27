import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  client_id: z.string().uuid()
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const { client_id } = validation.data;

    // Verify that client belongs to a CFO partner that the user owns
    const { data: company, error: companyError } = await supabase
      .from('company_settings')
      .select('cfo_partner_id, cfo_partners!inner(user_id)')
      .eq('id', client_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Client not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cfoPartner = Array.isArray(company.cfo_partners) ? company.cfo_partners[0] : company.cfo_partners;
    if (!cfoPartner || cfoPartner.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this client' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculating financial vitals for client: ${client_id}`);

    // Buscar todas as transações do cliente
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("type, gross_amount, net_amount, due_date, payment_date")
      .or(`customer_id.eq.${client_id},supplier_id.eq.${client_id}`);

    if (txError) {
      console.error("Error fetching transactions:", txError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transactions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calcular saldo de caixa (receitas pagas - despesas pagas)
    let cashBalance = 0;
    let arOverdue30d = 0; // Contas a receber vencidas > 30 dias
    let apDue7d = 0; // Contas a pagar < 7 dias
    
    // Projeção de caixa para os próximos 30 dias
    const projections: { [key: string]: number } = {};
    
    (transactions || []).forEach(tx => {
      const dueDate = new Date(tx.due_date);
      const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (tx.payment_date) {
        // Transação já paga
        if (tx.type === 'RECEIVABLE') {
          cashBalance += Number(tx.net_amount);
        } else {
          cashBalance -= Number(tx.net_amount);
        }
      } else {
        // Transação não paga
        if (tx.type === 'RECEIVABLE') {
          // Contas a receber
          if (daysDiff < -30) {
            // Vencida há mais de 30 dias
            arOverdue30d += Number(tx.net_amount);
          }
          // Adicionar à projeção
          if (daysDiff <= 30 && daysDiff >= 0) {
            const dateKey = new Date(today.getTime() + daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            projections[dateKey] = (projections[dateKey] || 0) + Number(tx.net_amount);
          }
        } else {
          // Contas a pagar
          if (daysDiff <= 7 && daysDiff >= 0) {
            apDue7d += Number(tx.net_amount);
          }
          // Adicionar à projeção (negativo)
          if (daysDiff <= 30 && daysDiff >= 0) {
            const dateKey = new Date(today.getTime() + daysDiff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            projections[dateKey] = (projections[dateKey] || 0) - Number(tx.net_amount);
          }
        }
      }
    });

    // Calcular projeção acumulada e determinar status
    let cumulativeBalance = cashBalance;
    let minBalanceDate: string | null = null;
    let minBalance = cashBalance;
    
    const sortedDates = Object.keys(projections).sort();
    for (const date of sortedDates) {
      cumulativeBalance += projections[date];
      if (cumulativeBalance < minBalance) {
        minBalance = cumulativeBalance;
        minBalanceDate = date;
      }
    }

    // Determinar status de projeção
    let cashProjectionStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    if (minBalance < 0 && minBalanceDate) {
      const daysToNegative = Math.floor((new Date(minBalanceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToNegative <= 7) {
        cashProjectionStatus = 'CRITICAL';
      } else {
        cashProjectionStatus = 'WARNING';
      }
    } else {
      cashProjectionStatus = 'HEALTHY';
    }

    const vitals = {
      cash_balance: Math.round(cashBalance),
      ar_overdue_30d: Math.round(arOverdue30d),
      ap_due_7d: Math.round(apDue7d),
      cash_projection_status: cashProjectionStatus,
      min_projected_balance: Math.round(minBalance),
      days_to_negative: minBalanceDate ? Math.floor((new Date(minBalanceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
    };

    console.log(`Financial vitals calculated:`, vitals);

    return new Response(
      JSON.stringify(vitals),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in cfo-get-client-vitals:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
