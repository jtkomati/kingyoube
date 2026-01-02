import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TomadasRequest {
  companyId: string;
  codigoCidade: string;
  nomeCidade?: string;
  periodoInicial: string;
  periodoFinal: string;
  inscricaoMunicipal?: string;
  login?: string;
  senha?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync-notas-tomadas...');

    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
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
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User authenticated: ${user.id}`);

    // 2. Get request body
    const body: TomadasRequest = await req.json();
    const { companyId, codigoCidade, nomeCidade, periodoInicial, periodoFinal, inscricaoMunicipal, login, senha } = body;

    if (!companyId || !codigoCidade || !periodoInicial || !periodoFinal) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: companyId, codigoCidade, periodoInicial, periodoFinal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get TecnoSpeed credentials
    const TECNOSPEED_TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    const TECNOSPEED_CNPJ_SH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');

    if (!TECNOSPEED_TOKEN || !TECNOSPEED_CNPJ_SH) {
      console.error('TecnoSpeed credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Credenciais TecnoSpeed não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get company CNPJ
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: companyData, error: companyError } = await supabase
      .from('company_settings')
      .select('cnpj, municipal_inscription')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData) {
      console.error('Company not found:', companyError?.message);
      return new Response(
        JSON.stringify({ error: 'Empresa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cnpjTomador = companyData.cnpj.replace(/\D/g, '');
    const inscricaoMunicipalValue = inscricaoMunicipal || companyData.municipal_inscription || '';

    console.log(`Initiating tomadas query for CNPJ: ${cnpjTomador}, City: ${codigoCidade}`);

    // 5. Build request payload for TecnoSpeed API
    const payload: Record<string, string> = {
      cpfCnpjSoftwareHouse: TECNOSPEED_CNPJ_SH.replace(/\D/g, ''),
      cnpj_tomador: cnpjTomador,
      codigo_cidade: codigoCidade,
      data_inicio: periodoInicial,
      data_fim: periodoFinal,
    };

    if (inscricaoMunicipalValue) {
      payload.inscricao_municipal = inscricaoMunicipalValue;
    }

    if (login && senha) {
      payload.login = login;
      payload.senha = senha;
    }

    console.log('Sending request to TecnoSpeed API...');

    // 6. Call TecnoSpeed API to start consultation
    const apiUrl = 'https://nfse.ns.eti.br/tomadas/v1/tomadas';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TECNOSPEED_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('TecnoSpeed API response status:', response.status);
    console.log('TecnoSpeed API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('TecnoSpeed API error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Erro na API TecnoSpeed', 
          details: responseData,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Extract protocol from response
    const protocolo = responseData.protocolo || responseData.data?.protocolo;
    
    if (!protocolo) {
      console.error('No protocol in response:', responseData);
      return new Response(
        JSON.stringify({ error: 'Protocolo não retornado pela API', response: responseData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Protocol received: ${protocolo}`);

    // 8. Save consultation to database
    const { data: consultaData, error: insertError } = await supabase
      .from('tomadas_consultas')
      .insert({
        company_id: companyId,
        protocolo: protocolo,
        codigo_cidade: codigoCidade,
        nome_cidade: nomeCidade || null,
        periodo_inicial: periodoInicial,
        periodo_final: periodoFinal,
        situacao: 'PROCESSANDO',
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving consultation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar consulta', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_role: 'FINANCEIRO',
      action: 'sync_notas_tomadas_started',
      details: `Iniciada consulta de notas tomadas. Protocolo: ${protocolo}, Cidade: ${codigoCidade}`,
      organization_id: companyId,
    });

    console.log('Consultation saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        protocolo: protocolo,
        consulta: consultaData,
        message: 'Consulta iniciada com sucesso. Aguarde o processamento.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in sync-notas-tomadas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
