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
    const { cfoPartnerId, industry, region } = await req.json();

    if (!cfoPartnerId || !industry || !region) {
      return new Response(
        JSON.stringify({ error: 'cfoPartnerId, industry e region são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Gerando leads para:', { industry, region });

    // Use Lovable AI to generate realistic prospect leads
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um especialista em prospecção de PMEs brasileiras. 
Gere uma lista de 10 empresas fictícias mas realistas do setor "${industry}" na região "${region}".
Para cada empresa, inclua: nome (criativo e realista), endereço (com bairro), telefone (formato brasileiro), email e um score de qualidade (0-100) baseado em potencial para CFO as a Service.

Retorne APENAS um array JSON no formato:
[
  {
    "company_name": "Nome Ltda",
    "address": "Rua X, 123 - Bairro Y, ${region}",
    "phone": "(11) 98765-4321",
    "email": "contato@empresa.com.br",
    "score": 85
  }
]`
          },
          {
            role: 'user',
            content: `Gere 10 leads de empresas de ${industry} em ${region} que seriam clientes ideais para um CFO as a Service.`
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable:', aiResponse.status, errorText);
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;
    
    console.log('Resposta da IA:', extractedText);

    // Parse the JSON response
    const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair JSON da resposta da IA');
    }

    const leads = JSON.parse(jsonMatch[0]);

    // Insert leads into database
    const leadsToInsert = leads.map((lead: any) => ({
      cfo_partner_id: cfoPartnerId,
      company_name: lead.company_name,
      industry: industry,
      region: region,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      score: lead.score || 50,
      status: 'LEAD',
      metadata: { generated_by: 'ai', generated_at: new Date().toISOString() }
    }));

    const { data: insertedLeads, error: insertError } = await supabase
      .from('partner_prospect_leads')
      .insert(leadsToInsert)
      .select();

    if (insertError) {
      console.error('Erro ao inserir leads:', insertError);
      throw insertError;
    }

    console.log(`${insertedLeads.length} leads gerados com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        leads: insertedLeads,
        count: insertedLeads.length
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