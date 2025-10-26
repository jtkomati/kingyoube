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
    const { fileUrl, fileName, userId } = await req.json();
    
    if (!fileUrl || !fileName || !userId) {
      return new Response(
        JSON.stringify({ error: 'fileUrl, fileName e userId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Baixando arquivo PDF:', fileUrl);
    
    // Download the PDF file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices-pdf')
      .download(fileUrl.split('/').pop());

    if (downloadError) {
      console.error('Erro ao baixar PDF:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao baixar PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert PDF to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('Processando PDF com OCR...');

    // Use Lovable AI with vision capabilities to extract invoice data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

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
            content: `Você é um especialista em extração de dados de notas fiscais brasileiras. 
Analise a nota fiscal e extraia EXATAMENTE as seguintes informações em formato JSON:
{
  "supplier_cnpj": "CNPJ do prestador (apenas números)",
  "supplier_name": "Razão social do prestador",
  "invoice_number": "Número da nota fiscal",
  "invoice_date": "Data de emissão (formato YYYY-MM-DD)",
  "service_code": "Código do serviço (LC 116/2003)",
  "gross_amount": valor bruto em número,
  "irrf_amount": valor retido de IRRF em número (0 se não houver),
  "pis_amount": valor retido de PIS em número (0 se não houver),
  "cofins_amount": valor retido de COFINS em número (0 se não houver),
  "csll_amount": valor retido de CSLL em número (0 se não houver),
  "iss_amount": valor retido de ISS em número (0 se não houver),
  "inss_amount": valor retido de INSS em número (0 se não houver)
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados desta nota fiscal de serviço:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
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
    const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Não foi possível extrair JSON da resposta da IA');
    }

    const invoiceData = JSON.parse(jsonMatch[0]);

    // Calculate net amount
    const netAmount = invoiceData.gross_amount - 
      (invoiceData.irrf_amount + invoiceData.pis_amount + 
       invoiceData.cofins_amount + invoiceData.csll_amount + 
       invoiceData.iss_amount + invoiceData.inss_amount);

    // Insert into database
    const { data: invoice, error: insertError } = await supabase
      .from('incoming_invoices')
      .insert({
        file_name: fileName,
        file_url: fileUrl,
        file_type: 'pdf',
        supplier_cnpj: invoiceData.supplier_cnpj,
        supplier_name: invoiceData.supplier_name,
        invoice_number: invoiceData.invoice_number,
        invoice_date: invoiceData.invoice_date,
        service_code: invoiceData.service_code,
        gross_amount: invoiceData.gross_amount,
        irrf_amount: invoiceData.irrf_amount || 0,
        pis_amount: invoiceData.pis_amount || 0,
        cofins_amount: invoiceData.cofins_amount || 0,
        csll_amount: invoiceData.csll_amount || 0,
        iss_amount: invoiceData.iss_amount || 0,
        inss_amount: invoiceData.inss_amount || 0,
        net_amount: netAmount,
        processing_status: 'completed',
        ocr_data: invoiceData,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir nota fiscal:', insertError);
      throw insertError;
    }

    console.log('Nota fiscal processada com sucesso:', invoice.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice,
        message: 'Nota fiscal processada com sucesso'
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