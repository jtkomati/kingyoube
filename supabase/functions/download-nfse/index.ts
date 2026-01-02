import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestSchema = z.object({
      transaction_id: z.string().uuid('transaction_id deve ser um UUID válido'),
      format: z.enum(['pdf', 'xml']).default('pdf'),
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transaction_id, format } = validation.data;
    console.log('Baixando NFS-e:', { transaction_id, format })

    // 1. Buscar transação
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, company_id')
      .eq('id', transaction_id)
      .single()

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transaction.invoice_number || transaction.invoice_status !== 'issued') {
      return new Response(
        JSON.stringify({ error: 'Nota fiscal não disponível para download. Status: ' + transaction.invoice_status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se já temos o arquivo salvo
    const bucketName = format === 'pdf' ? 'invoices-pdf' : 'invoices-xml'
    const fileName = `${transaction.company_id}/${transaction_id}.${format}`
    
    // Verificar se arquivo já existe
    const { data: existingFile } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600)
    
    if (existingFile?.signedUrl) {
      console.log('Arquivo já existe no storage, retornando URL assinada')
      return new Response(
        JSON.stringify({
          success: true,
          url: existingFile.signedUrl,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Buscar configuração PlugNotas
    const { data: fiscalConfig } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', transaction.company_id)
      .maybeSingle()

    if (!fiscalConfig?.plugnotas_token || fiscalConfig.plugnotas_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Integração PlugNotas não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = fiscalConfig.plugnotas_environment === 'PRODUCTION'
      ? 'https://api.plugnotas.com.br'
      : 'https://api.sandbox.plugnotas.com.br'

    // 3. Baixar arquivo do PlugNotas
    const integrationId = transaction.invoice_integration_id || transaction_id
    const downloadUrl = `${baseUrl}/nfse/${integrationId}/${format}`
    
    console.log('Baixando do PlugNotas:', { downloadUrl })
    
    const plugnotasResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': fiscalConfig.plugnotas_token,
      }
    })

    if (!plugnotasResponse.ok) {
      const errorText = await plugnotasResponse.text()
      console.error('Erro ao baixar do PlugNotas:', plugnotasResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Erro ao baixar arquivo do PlugNotas: ' + errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Salvar arquivo no storage
    const fileContent = await plugnotasResponse.arrayBuffer()
    const contentType = format === 'pdf' ? 'application/pdf' : 'application/xml'
    
    console.log('Salvando arquivo no storage:', { bucketName, fileName, size: fileContent.byteLength })
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileContent, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Erro ao salvar no storage:', uploadError)
      // Mesmo com erro no storage, retornar o arquivo diretamente
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Arquivo baixado mas não salvo no storage',
          content: btoa(String.fromCharCode(...new Uint8Array(fileContent))),
          contentType,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Gerar URL assinada
    const { data: signedUrl, error: signError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600)

    if (signError) {
      console.error('Erro ao gerar URL assinada:', signError)
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar URL de download' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Atualizar transação com URL
    const updateField = format === 'pdf' ? 'invoice_pdf_url' : 'invoice_xml_url'
    await supabase
      .from('transactions')
      .update({
        [updateField]: signedUrl.signedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    return new Response(
      JSON.stringify({
        success: true,
        url: signedUrl.signedUrl,
        format,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao baixar NFS-e:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
