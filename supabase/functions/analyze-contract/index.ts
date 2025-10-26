import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { contract_id, contract_text } = await req.json()

    console.log('Analisando contrato:', contract_id)

    // 1. Buscar contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      throw new Error('Contrato não encontrado')
    }

    // 2. Prompt especializado para análise jurídica
    const systemPrompt = `Você é um especialista em análise de contratos com foco em:
- Conformidade com melhores práticas de mercado
- LGPD (Lei Geral de Proteção de Dados)
- Identificação de riscos empresariais
- Cláusulas abusivas/leoninas
- Lucros cessantes e multas excessivas

Analise o contrato fornecido e retorne uma análise estruturada identificando:
1. CLÁUSULAS CONFORMES: Cláusulas que estão de acordo com as melhores práticas
2. CLÁUSULAS NÃO CONFORMES: Cláusulas problemáticas ou de alto risco
3. PONTOS DE ATENÇÃO: Cláusulas que merecem revisão

Para cada cláusula identificada, informe:
- Número/identificação da cláusula
- Título da cláusula
- Texto da cláusula
- Status (conforme/não conforme/atenção)
- Categoria de risco (LGPD, Financeiro, Responsabilidade, Abusiva, etc.)
- Nível de risco (baixo/médio/alto/crítico)
- Explicação detalhada do problema
- Recomendações

Forneça também:
- Score geral de conformidade (0-100)
- Nível de risco geral (baixo/médio/alto/crítico)
- Resumo executivo dos principais riscos`

    // 3. Chamar Gemini Flash para análise
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise o seguinte contrato:\n\n${contract_text}` }
        ],
        temperature: 0.3, // Baixa temperatura para análise mais precisa
      }),
    })

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const analysis = aiData.choices[0].message.content

    console.log('Análise concluída, processando resultado...')

    // 4. Processar e estruturar análise (parsing simplificado)
    // Em produção, usar structured output ou JSON mode
    const complianceScore = extractScore(analysis)
    const riskLevel = extractRiskLevel(analysis)

    // 5. Atualizar contrato com análise
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        ai_analysis: { full_analysis: analysis },
        ai_analyzed_at: new Date().toISOString(),
        compliance_score: complianceScore,
        risk_level: riskLevel,
      })
      .eq('id', contract_id)

    if (updateError) throw updateError

    // 6. Extrair e salvar cláusulas individuais (exemplo simplificado)
    const clauses = extractClauses(analysis)
    
    if (clauses.length > 0) {
      const { error: clausesError } = await supabase
        .from('contract_clauses')
        .insert(
          clauses.map(clause => ({
            contract_id,
            ...clause,
          }))
        )
      
      if (clausesError) console.error('Erro ao salvar cláusulas:', clausesError)
    }

    // 7. Criar auditoria
    await supabase.from('audit_logs').insert({
      user_id: contract.created_by,
      user_role: 'FINANCEIRO',
      action: 'analyze_contract',
      details: `Contrato ${contract.contract_number} analisado por IA`,
    })

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        compliance_score: complianceScore,
        risk_level: riskLevel,
        clauses_found: clauses.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao analisar contrato:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Funções auxiliares de parsing
function extractScore(text: string): number {
  const scoreMatch = text.match(/score|pontuação|conformidade[:\s]+(\d+)/i)
  return scoreMatch ? parseInt(scoreMatch[1]) : 50
}

function extractRiskLevel(text: string): string {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('crítico')) return 'critical'
  if (lowerText.includes('alto')) return 'high'
  if (lowerText.includes('médio')) return 'medium'
  return 'low'
}

function extractClauses(text: string): any[] {
  // Parsing simplificado - em produção usar structured output
  const clauses: any[] = []
  
  const sections = text.split(/CLÁUSULA|CLAUSE/i)
  
  sections.slice(1, 6).forEach((section, index) => { // Limitar a 5 primeiras
    const isNonCompliant = section.toLowerCase().includes('não conforme') || 
                          section.toLowerCase().includes('risco')
    
    clauses.push({
      clause_number: `${index + 1}`,
      clause_title: section.substring(0, 100).trim(),
      clause_text: section.substring(0, 500).trim(),
      compliance_status: isNonCompliant ? 'non_compliant' : 'compliant',
      risk_category: 'General',
      risk_level: isNonCompliant ? 'high' : 'low',
      ai_explanation: section.substring(0, 1000).trim(),
      recommendations: 'Revisar com advogado especializado',
    })
  })
  
  return clauses
}
