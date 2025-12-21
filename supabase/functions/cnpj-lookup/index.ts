import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  natureza_juridica: string;
  situacao_cadastral: number;
  situacao_cadastral_descricao: string;
  data_inicio_atividade: string;
  porte: string;
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      console.error('CNPJ not provided');
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/\D/g, '');

    if (cleanCNPJ.length !== 14) {
      console.error('Invalid CNPJ format:', cleanCNPJ);
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching CNPJ data from BrasilAPI:', cleanCNPJ);

    // Consultar BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error('CNPJ not found:', cleanCNPJ);
        return new Response(
          JSON.stringify({ error: 'CNPJ não encontrado na base da Receita Federal' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('BrasilAPI error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar CNPJ. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data: CNPJData = await response.json();

    console.log('CNPJ data retrieved successfully:', data.razao_social);

    // Formatar endereço completo
    const endereco = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      data.municipio,
      data.uf,
      data.cep?.replace(/(\d{5})(\d{3})/, '$1-$2')
    ].filter(Boolean).join(', ');

    // Determinar regime tributário baseado nas opções
    let taxRegime = 'LUCRO_PRESUMIDO';
    if (data.opcao_pelo_mei) {
      taxRegime = 'MEI';
    } else if (data.opcao_pelo_simples) {
      taxRegime = 'SIMPLES';
    }

    return new Response(
      JSON.stringify({
        cnpj: cleanCNPJ,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || data.razao_social,
        endereco,
        cnae: data.cnae_fiscal,
        cnaeDescricao: data.cnae_fiscal_descricao,
        naturezaJuridica: data.natureza_juridica,
        situacao: data.situacao_cadastral_descricao,
        dataAbertura: data.data_inicio_atividade,
        porte: data.porte,
        regimeTributario: taxRegime,
        municipio: data.municipio,
        uf: data.uf
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cnpj-lookup function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar consulta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
