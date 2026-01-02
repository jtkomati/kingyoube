import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getRoleLevel(role: string): number {
  const roleLevels: Record<string, number> = {
    'SUPERADMIN': 5,
    'ADMIN': 4,
    'FINANCEIRO': 3,
    'CONTADOR': 3,
    'FISCAL': 2,
    'USUARIO': 1,
    'VIEWER': 1,
  };
  return roleLevels[role] || 0;
}

async function categorizeTransaction(description: string): Promise<{ category: string; confidence: number }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, using rule-based categorization');
    return categorizeByRules(description);
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de categorização financeira. Analise a descrição da transação bancária e retorne a categoria mais adequada.

Categorias disponíveis:
- Receitas: PIX recebidos, TEDs recebidos, vendas, recebimentos de clientes
- Despesas Fixas: Aluguel, condomínio, internet, telefone, salários
- Despesas Variáveis: Compras, materiais, serviços diversos
- Impostos: DARF, DAS, IRRF, ISS, ICMS, tributos
- Financeiro: Juros, taxas bancárias, IOF, tarifas
- Investimentos: Aplicações, resgates, rendimentos
- Transferências: Transferências entre contas próprias
- Outros: Transações não identificadas

Responda APENAS com JSON no formato: {"category": "nome_categoria", "confidence": 0.95}`
          },
          {
            role: 'user',
            content: `Descrição da transação: "${description}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('AI categorization failed:', response.status);
      return categorizeByRules(description);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return {
          category: parsed.category || 'Outros',
          confidence: parsed.confidence || 0.5,
        };
      } catch {
        console.error('Failed to parse AI response:', content);
      }
    }
  } catch (error) {
    console.error('AI categorization error:', error);
  }

  return categorizeByRules(description);
}

function categorizeByRules(description: string): { category: string; confidence: number } {
  const desc = description.toUpperCase();
  
  if (desc.includes('PIX') && (desc.includes('RECEB') || desc.includes('CRED'))) {
    return { category: 'Receitas', confidence: 0.85 };
  }
  if (desc.includes('TED') && desc.includes('RECEB')) {
    return { category: 'Receitas', confidence: 0.85 };
  }
  if (desc.includes('ALUGUEL') || desc.includes('CONDOMINIO')) {
    return { category: 'Despesas Fixas', confidence: 0.9 };
  }
  if (desc.includes('DARF') || desc.includes('DAS') || desc.includes('IRRF') || desc.includes('ISS')) {
    return { category: 'Impostos', confidence: 0.95 };
  }
  if (desc.includes('TARIFA') || desc.includes('IOF') || desc.includes('TAXA')) {
    return { category: 'Financeiro', confidence: 0.9 };
  }
  if (desc.includes('APLICACAO') || desc.includes('RESGATE') || desc.includes('RENDIMENTO')) {
    return { category: 'Investimentos', confidence: 0.85 };
  }
  if (desc.includes('TRANSF') && (desc.includes('MESMA TIT') || desc.includes('PROPRIA'))) {
    return { category: 'Transferências', confidence: 0.9 };
  }
  
  return { category: 'Outros', confidence: 0.3 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting bank statement sync...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = roleData?.role || 'VIEWER';
    if (getRoleLevel(userRole) < 3) {
      return new Response(
        JSON.stringify({ error: 'Permissão insuficiente' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bank_account_id, start_date, end_date } = await req.json();

    if (!bank_account_id) {
      return new Response(
        JSON.stringify({ error: 'bank_account_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get bank account with account_hash
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bank_account_id)
      .single();

    if (bankError || !bankAccount) {
      return new Response(
        JSON.stringify({ error: 'Conta bancária não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create sync protocol
    const { data: protocol, error: protocolError } = await supabase
      .from('sync_protocols')
      .insert({
        bank_account_id,
        status: 'PROCESSING',
        created_by: user.id,
      })
      .select()
      .single();

    if (protocolError) {
      console.error('Failed to create sync protocol:', protocolError);
      return new Response(
        JSON.stringify({ error: 'Falha ao criar protocolo de sincronização' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created sync protocol: ${protocol.id}`);

    // Get TecnoSpeed credentials
    const TECNOSPEED_TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    const TECNOSPEED_LOGIN_AUTH = Deno.env.get('TECNOSPEED_LOGIN_AUTH');

    if (!TECNOSPEED_TOKEN || !TECNOSPEED_LOGIN_AUTH) {
      await supabase
        .from('sync_protocols')
        .update({
          status: 'FAILED',
          error_message: 'Credenciais TecnoSpeed não configuradas',
          completed_at: new Date().toISOString(),
        })
        .eq('id', protocol.id);

      return new Response(
        JSON.stringify({ error: 'Credenciais TecnoSpeed não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call TecnoSpeed API to get bank statement
    const accountHash = bankAccount.account_hash;
    
    if (!accountHash) {
      await supabase
        .from('sync_protocols')
        .update({
          status: 'FAILED',
          error_message: 'Conta não possui account_hash configurado',
          completed_at: new Date().toISOString(),
        })
        .eq('id', protocol.id);

      return new Response(
        JSON.stringify({ error: 'Conta não possui account_hash configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching statement for account: ${accountHash}`);

    // Build date range for TecnoSpeed API
    const startDateParam = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateParam = end_date || new Date().toISOString().split('T')[0];

    // TecnoSpeed Open Finance API call
    const isProduction = Deno.env.get('TECNOSPEED_ENVIRONMENT') === 'production';
    const baseUrl = isProduction 
      ? 'https://api.openfinance.tecnospeed.com.br'
      : 'https://api.sandbox.openfinance.tecnospeed.com.br';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    console.log(`Calling TecnoSpeed API: ${baseUrl}/v1/extrato/${accountHash}`);
    
    const tecnospeedResponse = await fetch(
      `${baseUrl}/v1/extrato/${accountHash}?dataInicio=${startDateParam}&dataFim=${endDateParam}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TECNOSPEED_TOKEN}`,
          'LoginAuth': TECNOSPEED_LOGIN_AUTH,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);

    if (!tecnospeedResponse.ok) {
      const errorText = await tecnospeedResponse.text();
      console.error('TecnoSpeed API error:', tecnospeedResponse.status, errorText);
      
      await supabase
        .from('sync_protocols')
        .update({
          status: 'FAILED',
          error_message: `Erro TecnoSpeed: ${tecnospeedResponse.status} - ${errorText}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', protocol.id);

      return new Response(
        JSON.stringify({ error: `Erro ao buscar extrato: ${tecnospeedResponse.status}` }),
        { status: tecnospeedResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statementData = await tecnospeedResponse.json();
    console.log('TecnoSpeed response received:', JSON.stringify(statementData).substring(0, 500));

    // Update bank account balance if available
    if (statementData.bankStatement?.balance !== undefined) {
      await supabase
        .from('bank_accounts')
        .update({
          balance: statementData.bankStatement.balance,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', bank_account_id);
    }

    // Process transactions
    let recordsImported = 0;
    const transactions = [];

    // Process credit transactions
    if (statementData.transactions?.credit) {
      for (const tx of statementData.transactions.credit) {
        transactions.push({ ...tx, type: 'credit' });
      }
    }

    // Process debit transactions
    if (statementData.transactions?.debit) {
      for (const tx of statementData.transactions.debit) {
        transactions.push({ ...tx, type: 'debit' });
      }
    }

    // Insert/update transactions with UPSERT
    for (const tx of transactions) {
      const externalId = tx.code || tx.uniqueId || `${tx.date}_${tx.amount}_${tx.description?.substring(0, 20)}`;
      
      // Categorize transaction
      const { category, confidence } = await categorizeTransaction(tx.description || '');

      const { error: upsertError } = await supabase
        .from('bank_statements')
        .upsert(
          {
            external_id: externalId,
            bank_account_id,
            statement_date: tx.date,
            description: tx.description,
            amount: Math.abs(tx.amount || tx.value || 0),
            type: tx.type,
            category,
            category_confidence: confidence,
            imported_by: user.id,
            imported_at: new Date().toISOString(),
            reconciliation_status: 'pending',
          },
          {
            onConflict: 'external_id',
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error('Error upserting transaction:', upsertError);
      } else {
        recordsImported++;
      }
    }

    // Update sync protocol
    await supabase
      .from('sync_protocols')
      .update({
        status: 'COMPLETED',
        records_imported: recordsImported,
        completed_at: new Date().toISOString(),
        protocol_number: statementData.protocol || protocol.id,
      })
      .eq('id', protocol.id);

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_role: userRole,
      action: 'sync_bank_statement',
      details: `Synchronized ${recordsImported} transactions for account ${bank_account_id}`,
    });

    console.log(`Sync completed: ${recordsImported} records imported`);

    return new Response(
      JSON.stringify({
        success: true,
        protocol_id: protocol.id,
        records_imported: recordsImported,
        balance: statementData.bankStatement?.balance,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in sync-bank-statement:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
