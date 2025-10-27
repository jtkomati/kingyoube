import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  cfoPartnerId: z.string().uuid(),
  clientName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100)
});

// Generate demo data for different industries
function generateDemoData(industry: string) {
  const baseData = {
    cash_balance: 50000,
    monthly_revenue: 80000,
    monthly_expenses: 65000,
    transactions: [] as any[]
  };

  // Industry-specific adjustments
  const industryProfiles: Record<string, any> = {
    'restaurante': {
      cash_balance: 35000,
      monthly_revenue: 120000,
      monthly_expenses: 95000,
      typical_transactions: [
        { description: 'Fornecedor de Alimentos', amount: -8500, category: 'Compras' },
        { description: 'Venda iFood', amount: 4200, category: 'Receitas' },
        { description: 'Folha de Pagamento', amount: -15000, category: 'Pessoal' },
        { description: 'Aluguel', amount: -5500, category: 'Fixos' }
      ]
    },
    'servicos_ti': {
      cash_balance: 85000,
      monthly_revenue: 150000,
      monthly_expenses: 80000,
      typical_transactions: [
        { description: 'Projeto Cliente A', amount: 35000, category: 'Receitas' },
        { description: 'AWS Infrastructure', amount: -4500, category: 'Tecnologia' },
        { description: 'Folha de Pagamento', amount: -45000, category: 'Pessoal' },
        { description: 'Marketing Digital', amount: -3200, category: 'Marketing' }
      ]
    },
    'varejo': {
      cash_balance: 42000,
      monthly_revenue: 95000,
      monthly_expenses: 72000,
      typical_transactions: [
        { description: 'Venda Loja Física', amount: 8500, category: 'Receitas' },
        { description: 'Fornecedor Produtos', amount: -12000, category: 'Compras' },
        { description: 'Energia Elétrica', amount: -1800, category: 'Fixos' },
        { description: 'Aluguel Loja', amount: -6500, category: 'Fixos' }
      ]
    }
  };

  const profile = industryProfiles[industry] || industryProfiles['servicos_ti'];

  return {
    ...baseData,
    ...profile,
    generated_at: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const { cfoPartnerId, clientName, industry } = validation.data;

    // Verify ownership
    const { data: partner, error: partnerError } = await supabase
      .from('cfo_partners')
      .select('id')
      .eq('id', cfoPartnerId)
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partner) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not have access to this CFO partner' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Criando sandbox demo para:', { clientName, industry });

    // Generate demo data
    const demoData = generateDemoData(industry);

    // Create sandbox
    const sandboxId = crypto.randomUUID();
    const sandboxUrl = `${supabaseUrl.replace('supabase.co', 'lovable.app')}/sandbox/${sandboxId}`;

    const { data: sandbox, error: insertError } = await supabase
      .from('client_sandboxes')
      .insert({
        cfo_partner_id: cfoPartnerId,
        client_name: clientName,
        industry: industry,
        sandbox_url: sandboxUrl,
        demo_data: demoData,
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar sandbox:', insertError);
      throw insertError;
    }

    console.log('Sandbox criado com sucesso:', sandbox.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        sandbox_url: sandboxUrl,
        sandbox_id: sandbox.id,
        demo_data: demoData,
        expires_at: sandbox.expires_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});