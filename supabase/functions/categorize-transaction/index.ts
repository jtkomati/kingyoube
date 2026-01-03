import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, bankAccountId } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: 'description é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for history lookup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, try to find similar transactions from history
    const historyResult = await findFromHistory(supabaseAdmin, description, bankAccountId);
    if (historyResult) {
      console.log('Found category from history:', historyResult);
      return new Response(
        JSON.stringify(historyResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no history match, try AI categorization
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not configured, using rule-based categorization');
      return new Response(
        JSON.stringify(categorizeByRules(description)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
            content: `Você é um assistente de categorização financeira para empresas brasileiras. Analise a descrição da transação bancária e retorne a categoria mais adequada.

Categorias disponíveis:
- Receitas: PIX recebidos, TEDs recebidos, vendas, recebimentos de clientes
- Despesas Fixas: Aluguel, condomínio, internet, telefone, salários fixos
- Despesas Variáveis: Compras, materiais, serviços diversos, despesas operacionais
- Impostos: DARF, DAS, IRRF, ISS, ICMS, PIS, COFINS, tributos em geral
- Financeiro: Juros, taxas bancárias, IOF, tarifas, encargos
- Investimentos: Aplicações, resgates, rendimentos, CDB, fundos
- Transferências: Transferências entre contas próprias, DOC/TED para mesma titularidade
- Folha de Pagamento: Salários, férias, 13º, FGTS, INSS
- Fornecedores: Pagamentos a fornecedores, boletos de compras
- Outros: Transações não identificadas ou que não se encaixam nas categorias anteriores

Analise cuidadosamente a descrição e retorne APENAS um JSON válido no formato:
{"category": "nome_categoria", "confidence": 0.95}

A confiança deve ser um número entre 0 e 1, onde:
- 0.9-1.0: Alta certeza
- 0.7-0.9: Boa certeza
- 0.5-0.7: Média certeza
- Abaixo de 0.5: Baixa certeza`
          },
          {
            role: 'user',
            content: `Descrição da transação: "${description}"`
          }
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', ...categorizeByRules(description) }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', ...categorizeByRules(description) }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('AI categorization failed:', response.status);
      return new Response(
        JSON.stringify(categorizeByRules(description)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        // Clean the response - sometimes it comes with markdown formatting
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent);
        return new Response(
          JSON.stringify({
            category: parsed.category || 'Outros',
            confidence: parsed.confidence || 0.5,
            source: 'ai',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse AI response:', content, parseError);
      }
    }

    return new Response(
      JSON.stringify({ ...categorizeByRules(description), source: 'fallback' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in categorize-transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Find category from historical transactions with similar descriptions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findFromHistory(
  supabaseClient: any,
  description: string,
  bankAccountId?: string
): Promise<{ category: string; confidence: number; source: string } | null> {
  try {
    // Extract keywords from description for matching
    const keywords = description
      .toUpperCase()
      .replace(/[0-9]/g, '') // Remove numbers
      .split(/\s+/)
      .filter(word => word.length > 3) // Only words longer than 3 chars
      .slice(0, 5); // Take first 5 keywords

    if (keywords.length === 0) return null;

    // Build query to find similar categorized transactions
    let query = supabaseClient
      .from('bank_statements')
      .select('category, category_confidence, description')
      .not('category', 'is', null)
      .eq('reconciliation_status', 'reconciled')
      .limit(20);

    // If we have a bank account, prioritize same account
    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    const { data: historicalData, error } = await query;

    if (error || !historicalData || historicalData.length === 0) {
      return null;
    }

    // Find best match by comparing keywords
    let bestMatch: { category: string; score: number } | null = null;

    for (const record of historicalData as Array<{ category: string | null; category_confidence: number | null; description: string | null }>) {
      if (!record.description || !record.category) continue;

      const recordKeywords = record.description
        .toUpperCase()
        .replace(/[0-9]/g, '')
        .split(/\s+/)
        .filter((word: string) => word.length > 3);

      // Calculate match score
      let matchCount = 0;
      for (const keyword of keywords) {
        if (recordKeywords.some((rk: string) => rk.includes(keyword) || keyword.includes(rk))) {
          matchCount++;
        }
      }

      const score = matchCount / keywords.length;

      if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { category: record.category, score };
      }
    }

    if (bestMatch && bestMatch.score >= 0.5) {
      return {
        category: bestMatch.category,
        confidence: Math.min(0.95, 0.7 + (bestMatch.score * 0.25)),
        source: 'history',
      };
    }

    return null;
  } catch (error) {
    console.error('Error finding from history:', error);
    return null;
  }
}

function categorizeByRules(description: string): { category: string; confidence: number; source: string } {
  const desc = description.toUpperCase();
  
  // Receitas
  if (desc.includes('PIX') && (desc.includes('RECEB') || desc.includes('CRED'))) {
    return { category: 'Receitas', confidence: 0.85, source: 'rules' };
  }
  if (desc.includes('TED') && (desc.includes('RECEB') || desc.includes('CRED'))) {
    return { category: 'Receitas', confidence: 0.85, source: 'rules' };
  }
  if (desc.includes('DEPOSITO') || desc.includes('DEPÓSITO')) {
    return { category: 'Receitas', confidence: 0.75, source: 'rules' };
  }
  
  // Despesas Fixas
  if (desc.includes('ALUGUEL') || desc.includes('CONDOMINIO') || desc.includes('CONDÔMINIO')) {
    return { category: 'Despesas Fixas', confidence: 0.9, source: 'rules' };
  }
  if (desc.includes('INTERNET') || desc.includes('TELEFONE') || desc.includes('CLARO') || desc.includes('VIVO') || desc.includes('TIM')) {
    return { category: 'Despesas Fixas', confidence: 0.85, source: 'rules' };
  }
  
  // Impostos
  if (desc.includes('DARF') || desc.includes('DAS') || desc.includes('IRRF') || desc.includes('ISS') || desc.includes('ICMS')) {
    return { category: 'Impostos', confidence: 0.95, source: 'rules' };
  }
  if (desc.includes('PIS') || desc.includes('COFINS') || desc.includes('CSLL') || desc.includes('SIMPLES NACIONAL')) {
    return { category: 'Impostos', confidence: 0.95, source: 'rules' };
  }
  
  // Financeiro
  if (desc.includes('TARIFA') || desc.includes('IOF') || desc.includes('TAXA') || desc.includes('JUROS')) {
    return { category: 'Financeiro', confidence: 0.9, source: 'rules' };
  }
  
  // Investimentos
  if (desc.includes('APLICACAO') || desc.includes('APLICAÇÃO') || desc.includes('RESGATE') || desc.includes('RENDIMENTO')) {
    return { category: 'Investimentos', confidence: 0.85, source: 'rules' };
  }
  if (desc.includes('CDB') || desc.includes('FUNDO') || desc.includes('POUPANCA') || desc.includes('POUPANÇA')) {
    return { category: 'Investimentos', confidence: 0.85, source: 'rules' };
  }
  
  // Transferências
  if (desc.includes('TRANSF') && (desc.includes('MESMA TIT') || desc.includes('PROPRIA') || desc.includes('PRÓPRIA'))) {
    return { category: 'Transferências', confidence: 0.9, source: 'rules' };
  }
  
  // Folha de Pagamento
  if (desc.includes('SALARIO') || desc.includes('SALÁRIO') || desc.includes('FOLHA')) {
    return { category: 'Folha de Pagamento', confidence: 0.9, source: 'rules' };
  }
  if (desc.includes('FGTS') || desc.includes('INSS') || desc.includes('FERIAS') || desc.includes('FÉRIAS') || desc.includes('13')) {
    return { category: 'Folha de Pagamento', confidence: 0.85, source: 'rules' };
  }
  
  // Fornecedores
  if (desc.includes('BOLETO') || desc.includes('FORNEC')) {
    return { category: 'Fornecedores', confidence: 0.7, source: 'rules' };
  }
  
  return { category: 'Outros', confidence: 0.3, source: 'rules' };
}
