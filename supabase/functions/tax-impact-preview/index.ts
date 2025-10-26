const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simulação simplificada de impostos (Reforma Tributária / Split Payment)
function calculateTaxes(grossAmount: number, category: string, type: 'RECEIVABLE' | 'PAYABLE') {
  const taxes: { name: string; amount: number }[] = []
  let totalTaxes = 0

  if (type === 'RECEIVABLE') {
    // Impostos sobre receitas
    const ibs = grossAmount * 0.026 // IBS ~2.6%
    const cbs = grossAmount * 0.089 // CBS ~8.9%
    
    taxes.push({ name: 'IBS', amount: ibs })
    taxes.push({ name: 'CBS', amount: cbs })
    totalTaxes = ibs + cbs

    // Adicionar IS (Imposto Seletivo) se aplicável
    if (category === 'VENDAS' || category === 'SERVICOS') {
      const is = grossAmount * 0.01 // IS ~1%
      taxes.push({ name: 'IS', amount: is })
      totalTaxes += is
    }
  } else {
    // Impostos sobre despesas/pagamentos - geralmente retidos
    const irrf = grossAmount * 0.015 // IRRF ~1.5%
    taxes.push({ name: 'IRRF Retido', amount: irrf })
    totalTaxes = irrf
  }

  const netAmount = grossAmount - totalTaxes

  return {
    grossAmount,
    netAmount: Math.max(0, netAmount),
    taxes,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { grossAmount, category, type } = await req.json()

    if (!grossAmount || !category || !type) {
      return new Response(
        JSON.stringify({ error: 'grossAmount, category e type são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Calculando preview de impostos:', { grossAmount, category, type })

    const result = calculateTaxes(grossAmount, category, type)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
