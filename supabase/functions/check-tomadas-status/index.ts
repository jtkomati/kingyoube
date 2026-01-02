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
    console.log('Starting check-tomadas-status...');

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
    const { protocolo, consultaId } = await req.json();

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

    // 4. Get consultation from database if consultaId provided
    let protocoloToCheck = protocolo;
    let consultaRecord = null;

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
      
      protocoloToCheck = data.protocolo;
      consultaRecord = data;
    }

    console.log(`Checking status for protocol: ${protocoloToCheck}`);

    // 5. Call TecnoSpeed API to check status
    const apiUrl = `https://nfse.ns.eti.br/tomadas/v1/tomadas/${protocoloToCheck}`;
    
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

    // 6. Parse status from response
    const situacao = responseData.situacao || responseData.status || 'PROCESSANDO';
    const totalNotas = responseData.total_notas || responseData.totalNotas || 0;
    const mensagemErro = responseData.mensagem_erro || responseData.erro || null;

    console.log(`Status: ${situacao}, Total notes: ${totalNotas}`);

    // 7. Update consultation in database
    if (consultaRecord || protocolo) {
      const updateQuery = consultaId 
        ? supabase.from('tomadas_consultas').update({
            situacao: situacao,
            total_notas: totalNotas,
            mensagem_erro: mensagemErro,
            updated_at: new Date().toISOString(),
          }).eq('id', consultaId)
        : supabase.from('tomadas_consultas').update({
            situacao: situacao,
            total_notas: totalNotas,
            mensagem_erro: mensagemErro,
            updated_at: new Date().toISOString(),
          }).eq('protocolo', protocoloToCheck);

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Error updating consultation:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocolo: protocoloToCheck,
        situacao: situacao,
        totalNotas: totalNotas,
        mensagemErro: mensagemErro,
        apiResponse: responseData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in check-tomadas-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
