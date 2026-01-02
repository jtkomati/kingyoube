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
    console.log('Starting fetch-tomadas-notas...');

    // 1. Verify authentication
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

    // 2. Get request body
    const { protocolo, consultaId, pagina = 1 } = await req.json();

    if (!protocolo && !consultaId) {
      return new Response(
        JSON.stringify({ error: 'Protocolo ou consultaId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get TecnoSpeed credentials
    const TECNOSPEED_TOKEN = Deno.env.get('TECNOSPEED_TOKEN');

    if (!TECNOSPEED_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Credenciais TecnoSpeed não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Get consultation from database
    let protocoloToFetch = protocolo;
    let companyId: string | null = null;

    if (consultaId) {
      const { data, error } = await supabase
        .from('tomadas_consultas')
        .select('*')
        .eq('id', consultaId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Consulta não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      protocoloToFetch = data.protocolo;
      companyId = data.company_id;

      // Check if status is CONCLUIDO
      if (data.situacao !== 'CONCLUIDO') {
        return new Response(
          JSON.stringify({ 
            error: 'Consulta ainda não concluída', 
            situacao: data.situacao,
            message: 'Aguarde a conclusão do processamento para buscar as notas.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Fetching notes for protocol: ${protocoloToFetch}, page: ${pagina}`);

    // 5. Call TecnoSpeed API to get notes
    const apiUrl = `https://nfse.ns.eti.br/tomadas/v1/tomadas/${protocoloToFetch}/notas?pagina=${pagina}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TECNOSPEED_TOKEN}`,
      },
    });

    const responseText = await response.text();
    console.log('TecnoSpeed API response status:', response.status);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('TecnoSpeed API error:', responseData);
      return new Response(
        JSON.stringify({ error: 'Erro na API TecnoSpeed', details: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Extract notes from response
    const notas = responseData.notas || responseData.data?.notas || [];
    const totalPaginas = responseData.total_paginas || responseData.totalPaginas || 1;
    const totalNotas = responseData.total_notas || responseData.totalNotas || notas.length;

    console.log(`Received ${notas.length} notes, page ${pagina} of ${totalPaginas}`);

    // 7. Import notes to incoming_invoices if companyId is available
    let importedCount = 0;
    const errors: string[] = [];

    if (companyId && notas.length > 0) {
      for (const nota of notas) {
        try {
          // Check if already exists
          const existingCheck = await supabase
            .from('incoming_invoices')
            .select('id')
            .eq('company_id', companyId)
            .eq('invoice_number', nota.numero || nota.numeroNfse)
            .eq('supplier_cnpj', (nota.cnpj_prestador || nota.prestador?.cnpj || '').replace(/\D/g, ''))
            .maybeSingle();

          if (existingCheck.data) {
            console.log(`Note ${nota.numero} already exists, skipping`);
            continue;
          }

          // Insert new invoice
          const { error: insertError } = await supabase
            .from('incoming_invoices')
            .insert({
              company_id: companyId,
              file_name: `NFS-e ${nota.numero || nota.numeroNfse}`,
              file_url: nota.link_xml || nota.linkXml || '',
              file_type: 'xml',
              supplier_cnpj: (nota.cnpj_prestador || nota.prestador?.cnpj || '').replace(/\D/g, ''),
              supplier_name: nota.razao_social_prestador || nota.prestador?.razaoSocial || 'Prestador não identificado',
              invoice_number: nota.numero || nota.numeroNfse || null,
              invoice_date: nota.data_emissao || nota.dataEmissao || null,
              gross_amount: parseFloat(nota.valor_servicos || nota.valorServicos || '0'),
              net_amount: parseFloat(nota.valor_liquido || nota.valorLiquido || nota.valor_servicos || nota.valorServicos || '0'),
              iss_amount: parseFloat(nota.valor_iss || nota.valorIss || '0'),
              service_code: nota.codigo_servico || nota.codigoServico || null,
              processing_status: 'completed',
              created_by: user.id,
            });

          if (insertError) {
            console.error('Error inserting invoice:', insertError);
            errors.push(`Nota ${nota.numero}: ${insertError.message}`);
          } else {
            importedCount++;
          }
        } catch (noteError) {
          console.error('Error processing note:', noteError);
          errors.push(`Nota ${nota.numero}: ${noteError instanceof Error ? noteError.message : 'Erro desconhecido'}`);
        }
      }

      // Update consultation with imported count
      if (consultaId) {
        await supabase
          .from('tomadas_consultas')
          .update({
            notas_importadas: importedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', consultaId);
      }
    }

    // 8. Log audit
    if (companyId) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_role: 'FINANCEIRO',
        action: 'fetch_tomadas_notas',
        details: `Importadas ${importedCount} notas do protocolo ${protocoloToFetch}`,
        organization_id: companyId,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocolo: protocoloToFetch,
        pagina: pagina,
        totalPaginas: totalPaginas,
        totalNotas: totalNotas,
        notasRecebidas: notas.length,
        notasImportadas: importedCount,
        errors: errors.length > 0 ? errors : undefined,
        notas: notas,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in fetch-tomadas-notas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
