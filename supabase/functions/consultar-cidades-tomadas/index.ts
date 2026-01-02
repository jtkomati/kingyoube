import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de cidades homologadas (cache local - algumas das principais)
const CIDADES_HOMOLOGADAS = [
  { codigo: '3550308', nome: 'São Paulo', uf: 'SP', requerCertificado: true, requerLogin: false },
  { codigo: '3509502', nome: 'Campinas', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3304557', nome: 'Rio de Janeiro', uf: 'RJ', requerCertificado: true, requerLogin: false },
  { codigo: '4106902', nome: 'Curitiba', uf: 'PR', requerCertificado: false, requerLogin: true },
  { codigo: '4314902', nome: 'Porto Alegre', uf: 'RS', requerCertificado: false, requerLogin: true },
  { codigo: '3106200', nome: 'Belo Horizonte', uf: 'MG', requerCertificado: false, requerLogin: true },
  { codigo: '2927408', nome: 'Salvador', uf: 'BA', requerCertificado: false, requerLogin: true },
  { codigo: '2304400', nome: 'Fortaleza', uf: 'CE', requerCertificado: false, requerLogin: true },
  { codigo: '2611606', nome: 'Recife', uf: 'PE', requerCertificado: false, requerLogin: true },
  { codigo: '5300108', nome: 'Brasília', uf: 'DF', requerCertificado: false, requerLogin: true },
  { codigo: '3518800', nome: 'Guarulhos', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3534401', nome: 'Osasco', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3547809', nome: 'Santo André', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3548708', nome: 'São Bernardo do Campo', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3513801', nome: 'Diadema', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3529401', nome: 'Mauá', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3505708', nome: 'Barueri', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3552205', nome: 'Sorocaba', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3543402', nome: 'Ribeirão Preto', uf: 'SP', requerCertificado: false, requerLogin: true },
  { codigo: '3549904', nome: 'São José do Rio Preto', uf: 'SP', requerCertificado: false, requerLogin: true },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting consultar-cidades-tomadas...');

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

    // 2. Get search parameters
    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const uf = url.searchParams.get('uf')?.toUpperCase() || '';

    // 3. Try to get full list from TecnoSpeed API
    const TECNOSPEED_TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    
    let cidades = CIDADES_HOMOLOGADAS;
    let fromApi = false;

    if (TECNOSPEED_TOKEN) {
      try {
        const apiUrl = 'https://nfse.ns.eti.br/tomadas/v1/cidades';
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${TECNOSPEED_TOKEN}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.cidades && Array.isArray(data.cidades)) {
            cidades = data.cidades.map((c: { codigo?: string; codigo_cidade?: string; nome?: string; uf?: string; requer_certificado?: boolean; requerCertificado?: boolean; requer_login?: boolean; requerLogin?: boolean }) => ({
              codigo: c.codigo || c.codigo_cidade,
              nome: c.nome,
              uf: c.uf,
              requerCertificado: c.requer_certificado || c.requerCertificado || false,
              requerLogin: c.requer_login || c.requerLogin || false,
            }));
            fromApi = true;
          }
        }
      } catch (apiError) {
        console.log('Could not fetch from API, using local cache:', apiError);
      }
    }

    // 4. Filter cities
    let filteredCidades = cidades;
    
    if (search) {
      filteredCidades = filteredCidades.filter(c => 
        c.nome.toLowerCase().includes(search) || 
        c.codigo.includes(search)
      );
    }
    
    if (uf) {
      filteredCidades = filteredCidades.filter(c => c.uf === uf);
    }

    // 5. Sort alphabetically
    filteredCidades.sort((a, b) => a.nome.localeCompare(b.nome));

    console.log(`Returning ${filteredCidades.length} cities (from API: ${fromApi})`);

    return new Response(
      JSON.stringify({
        success: true,
        total: filteredCidades.length,
        fromApi: fromApi,
        cidades: filteredCidades,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in consultar-cidades-tomadas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
