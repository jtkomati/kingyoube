import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-nfe-destinadas] Buscando NF-e para company_id: ${company_id}`);

    // Get PlugNotas config
    const { data: config, error: configError } = await supabase
      .from('config_fiscal')
      .select('plugnotas_token, plugnotas_environment, plugnotas_status')
      .eq('company_id', company_id)
      .maybeSingle();

    if (configError) {
      console.error('[sync-nfe-destinadas] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configuração fiscal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config || !config.plugnotas_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PlugNotas não configurado. Acesse Notas Fiscais > Configurações para configurar.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.plugnotas_status !== 'connected') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PlugNotas não está conectado. Verifique suas credenciais nas configurações.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block SANDBOX environment - DF-e requires production and digital certificate
    if (config.plugnotas_environment === 'SANDBOX') {
      console.log('[sync-nfe-destinadas] Blocked: SANDBOX environment does not support DF-e');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A sincronização de NF-e Destinadas não está disponível em ambiente Sandbox. Configure o ambiente de Produção e cadastre um certificado digital A1 na PlugNotas para utilizar esta funcionalidade.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Production base URL only
    const baseUrl = 'https://api.plugnotas.com.br';

    // Get company CNPJ for the query
    const { data: company, error: companyError } = await supabase
      .from('company_settings')
      .select('cnpj')
      .eq('id', company_id)
      .single();

    if (companyError || !company?.cnpj) {
      console.error('[sync-nfe-destinadas] Erro ao buscar CNPJ:', companyError);
      return new Response(
        JSON.stringify({ success: false, error: 'CNPJ da empresa não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean CNPJ (remove formatting)
    const cleanCnpj = company.cnpj.replace(/[^\d]/g, '');

    console.log(`[sync-nfe-destinadas] Consultando NF-e destinadas para CNPJ: ${cleanCnpj}`);

    // Call PlugNotas API to get NF-e destinadas - CNPJ goes in the path
    // Note: This endpoint requires a digital certificate registered with PlugNotas
    const response = await fetch(`${baseUrl}/nfe/${cleanCnpj}/destinadas?pagina=1&porPagina=50`, {
      method: 'GET',
      headers: {
        'x-api-key': config.plugnotas_token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-nfe-destinadas] Erro da API PlugNotas:', response.status, errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Funcionalidade de NF-e Destinadas não habilitada. Verifique se sua empresa possui certificado digital A1 cadastrado na PlugNotas e se a opção DF-e está ativa no cadastro da empresa.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Token de API inválido ou sem permissão. Verifique suas credenciais na PlugNotas.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 400 && errorText.includes('certificado')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Certificado digital A1 não cadastrado. Cadastre seu certificado na PlugNotas para usar esta funcionalidade.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Erro da API PlugNotas: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nfeData = await response.json();
    console.log(`[sync-nfe-destinadas] Recebido ${nfeData?.data?.length || 0} NF-e`);

    let importedCount = 0;

    // Process each NF-e and import to incoming_invoices
    if (nfeData?.data && Array.isArray(nfeData.data)) {
      for (const nfe of nfeData.data) {
        try {
          // Check if already imported (by chave/key)
          const { data: existing } = await supabase
            .from('incoming_invoices')
            .select('id')
            .eq('company_id', company_id)
            .eq('invoice_number', nfe.numero || nfe.chave)
            .maybeSingle();

          if (existing) {
            console.log(`[sync-nfe-destinadas] NF-e ${nfe.numero} já importada, pulando`);
            continue;
          }

          // Insert new incoming invoice
          const { error: insertError } = await supabase
            .from('incoming_invoices')
            .insert({
              company_id: company_id,
              supplier_cnpj: nfe.emitente?.cnpj || nfe.cnpjEmitente || '',
              supplier_name: nfe.emitente?.razaoSocial || nfe.razaoSocialEmitente || 'Não identificado',
              invoice_number: nfe.numero || nfe.chave || '',
              invoice_date: nfe.dataEmissao || new Date().toISOString(),
              gross_amount: nfe.valorTotal || nfe.valor || 0,
              net_amount: nfe.valorTotal || nfe.valor || 0,
              irrf_amount: 0,
              pis_amount: 0,
              cofins_amount: 0,
              csll_amount: 0,
              iss_amount: 0,
              inss_amount: 0,
              processing_status: 'completed',
              service_code: 'NF-e',
              file_name: `nfe_${nfe.chave || nfe.numero}.xml`,
              ocr_data: nfe,
            });

          if (insertError) {
            console.error('[sync-nfe-destinadas] Erro ao inserir NF-e:', insertError);
          } else {
            importedCount++;
          }
        } catch (nfeError) {
          console.error('[sync-nfe-destinadas] Erro ao processar NF-e:', nfeError);
        }
      }
    }

    // Log the sync operation
    await supabase.from('sync_logs').insert({
      company_id: company_id,
      sync_type: 'nfe_destinadas',
      status: 'success',
      details: { imported_count: importedCount, total_found: nfeData?.data?.length || 0 },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: importedCount > 0 
          ? `${importedCount} NF-e importada(s) com sucesso.`
          : 'Nenhuma nova NF-e encontrada para importar.',
        imported_count: importedCount,
        total_found: nfeData?.data?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-nfe-destinadas] Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
