import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 512; // Smaller chunks to avoid stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    // Use apply to avoid spread operator issues
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

// Helper function to process PDF with Lovable AI
async function processWithLovableAI(fileData: Blob) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // Convert PDF to base64 safely
  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

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

  return JSON.parse(jsonMatch[0]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const requestSchema = z.object({
      filePath: z.string().min(1).max(500),
      fileName: z.string().min(1).max(255),
      userId: z.string().uuid('userId deve ser um UUID válido')
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { filePath, fileName, userId } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Baixando arquivo PDF do path:', filePath);
    
    // Download the PDF file from storage bucket using the full path
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('invoices-pdf')
      .download(filePath);

    if (downloadError) {
      console.error('Erro ao baixar PDF:', downloadError);
      return new Response(
        JSON.stringify({ error: `Erro ao baixar PDF: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando PDF com OCR externo...');

    // Get Cloudflare Access credentials
    const CF_CLIENT_ID = Deno.env.get('CF_ACCESS_CLIENT_ID');
    const CF_CLIENT_SECRET = Deno.env.get('CF_ACCESS_CLIENT_SECRET');
    
    if (!CF_CLIENT_ID || !CF_CLIENT_SECRET) {
      throw new Error('Credenciais do Cloudflare Access não configuradas');
    }

    // Create a signed URL that expires in 10 minutes (600 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('invoices-pdf')
      .createSignedUrl(filePath, 600);

    if (signedUrlError || !signedUrlData) {
      console.error('Erro ao criar URL assinada:', signedUrlError);
      throw new Error('Erro ao gerar URL temporária para o arquivo');
    }

    const temporaryUrl = signedUrlData.signedUrl;
    console.log('URL temporária criada (válida por 10 minutos)');

    // Call external OCR service
    const ocrResponse = await fetch('https://automacao-nova.secureblueteam.com.br/webhook/CFO-Upload', {
      method: 'POST',
      headers: {
        'CF-Access-Client-Id': CF_CLIENT_ID,
        'CF-Access-Client-Secret': CF_CLIENT_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_url: temporaryUrl
      }),
    });

    console.log('Status da resposta do OCR:', ocrResponse.status);
    console.log('Headers da resposta:', Object.fromEntries(ocrResponse.headers.entries()));

    // Ler resposta como texto primeiro (só pode ler uma vez)
    const responseText = await ocrResponse.text();
    console.log('Resposta do OCR (texto):', responseText);

    if (!ocrResponse.ok) {
      console.error('Erro no serviço de OCR:', {
        status: ocrResponse.status,
        statusText: ocrResponse.statusText,
        bodyPreview: responseText.substring(0, 500)
      });
      
      // Mensagens de erro específicas por status
      if (ocrResponse.status === 502) {
        throw new Error('Serviço de OCR está temporariamente indisponível (502 Bad Gateway). Por favor, tente novamente em alguns minutos ou verifique se o servidor está online.');
      } else if (ocrResponse.status === 403) {
        throw new Error('Acesso negado ao serviço de OCR (403). Verifique as credenciais do Cloudflare Access.');
      } else if (ocrResponse.status === 503) {
        throw new Error('Serviço de OCR está em manutenção (503). Tente novamente mais tarde.');
      } else {
        throw new Error(`Erro no serviço de OCR (${ocrResponse.status}): ${ocrResponse.statusText}`);
      }
    }

    // Tentar fazer parse do JSON
    let invoiceData;
    try {
      if (!responseText || responseText.trim() === '') {
        console.log('Resposta vazia do OCR externo, usando Lovable AI como fallback...');
        invoiceData = await processWithLovableAI(fileData);
      } else {
        let parsedResponse = JSON.parse(responseText);
        
        // Se for um array, pega o primeiro elemento
        if (Array.isArray(parsedResponse)) {
          parsedResponse = parsedResponse[0];
        }
        
        console.log('Resposta parseada do webhook:', JSON.stringify(parsedResponse, null, 2));
        
        // Verificar se a resposta tem a estrutura do Gemini (candidates)
        if (parsedResponse.candidates && parsedResponse.candidates[0]) {
          console.log('Resposta do webhook no formato Gemini, extraindo dados...');
          let textContent = parsedResponse.candidates[0].content.parts[0].text;
          console.log('Texto extraído:', textContent);
          
          // Remover bloco de código markdown se existir
          textContent = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          // Extrair JSON do texto
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error('Não encontrou JSON no texto:', textContent);
            throw new Error('Não foi possível extrair JSON da resposta do webhook');
          }
          
          const extractedData = JSON.parse(jsonMatch[0]);
          console.log('Dados extraídos antes do mapeamento:', JSON.stringify(extractedData, null, 2));
          
          // Mapear campos do webhook para o formato esperado
          // O webhook retorna estrutura com sender_cnpj, sender_corporate_name, etc.
          invoiceData = {
            supplier_cnpj: extractedData.sender_cnpj || extractedData.issuer?.cnpj || extractedData.cnpj_emitente || extractedData.supplier_cnpj,
            supplier_name: extractedData.sender_corporate_name || extractedData.issuer?.name || extractedData.nome_emitente || extractedData.supplier_name,
            invoice_number: extractedData.invoice_number || extractedData.nfe_number || extractedData.numero_nota,
            invoice_date: extractedData.issue_date?.split('T')[0] || extractedData.data_emissao || extractedData.invoice_date,
            service_code: extractedData.codigo_servico || extractedData.service_code || '0000',
            gross_amount: extractedData.total_invoice || extractedData.total_products || extractedData.tax_summary?.total_invoice || extractedData.valor_total_nota || extractedData.gross_amount || 0,
            irrf_amount: extractedData.tax_summary?.irrf || extractedData.valor_irrf || extractedData.irrf_amount || 0,
            pis_amount: extractedData.value_pis || extractedData.tax_summary?.value_pis || extractedData.valor_pis || extractedData.pis_amount || 0,
            cofins_amount: extractedData.value_cofins || extractedData.tax_summary?.value_cofins || extractedData.valor_cofins || extractedData.cofins_amount || 0,
            csll_amount: extractedData.csll_retained || extractedData.tax_summary?.csll_retained || extractedData.valor_csll || extractedData.csll_amount || 0,
            iss_amount: extractedData.total_issqn || extractedData.tax_summary?.total_issqn || extractedData.valor_iss || extractedData.iss_amount || 0,
            inss_amount: extractedData.social_security_contribution || extractedData.tax_summary?.social_security_contribution || extractedData.valor_inss || extractedData.inss_amount || 0,
          };
          
          console.log('Dados da nota fiscal mapeados:', JSON.stringify(invoiceData, null, 2));
          
          // Validar apenas CNPJ obrigatório - aceitar supplier_name vazio temporariamente
          if (!invoiceData.supplier_cnpj) {
            console.error('CNPJ não foi extraído:', invoiceData);
            throw new Error('CNPJ obrigatório não foi extraído corretamente');
          }

          // Se supplier_name estiver vazio, usar o CNPJ como nome temporário
          if (!invoiceData.supplier_name) {
            console.log('Supplier name vazio, usando CNPJ como nome temporário');
            invoiceData.supplier_name = `Fornecedor ${invoiceData.supplier_cnpj}`;
          }
        } else {
          // Resposta já está no formato esperado
          invoiceData = parsedResponse;
          console.log('Dados extraídos do OCR:', invoiceData);
        }
      }
    } catch (jsonError) {
      console.error('Erro ao fazer parse do JSON:', jsonError);
      console.error('Resposta recebida:', responseText.substring(0, 500));
      
      // Se não conseguiu extrair dados do webhook, retornar erro
      throw new Error('Não foi possível processar os dados da nota fiscal. Por favor, tente novamente.');
    }

    // Get user's company_id from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
    }

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
        file_url: temporaryUrl,
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
        company_id: profile?.company_id,
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