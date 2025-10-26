import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format number with zeros to the left
function padLeft(value: string | number, length: number, char: string = '0'): string {
  return String(value).padStart(length, char);
}

// Format number with zeros to the right
function padRight(value: string, length: number, char: string = ' '): string {
  return value.padEnd(length, char);
}

// Format currency value (remove decimals, multiply by 100)
function formatCurrency(value: number): string {
  return padLeft(Math.round(value * 100), 15);
}

// Format date to DDMMYY
function formatDate(date: string): string {
  const d = new Date(date);
  const day = padLeft(d.getDate(), 2);
  const month = padLeft(d.getMonth() + 1, 2);
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceIds } = await req.json();
    
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'invoiceIds deve ser um array não vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get invoices
    const { data: invoices, error: fetchError } = await supabase
      .from('incoming_invoices')
      .select('*')
      .in('id', invoiceIds)
      .eq('processing_status', 'completed');

    if (fetchError) {
      console.error('Erro ao buscar notas fiscais:', fetchError);
      throw fetchError;
    }

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma nota fiscal encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company settings
    const { data: settings } = await supabase
      .from('company_settings')
      .select('*')
      .single();

    if (!settings) {
      return new Response(
        JSON.stringify({ error: 'Configurações da empresa não encontradas' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cnabLines: string[] = [];
    const today = new Date();
    const todayStr = formatDate(today.toISOString());

    // Header do arquivo (Registro 0)
    let headerLine = '0'; // Tipo de registro
    headerLine += '1'; // Tipo de operação (1 = Remessa)
    headerLine += 'REMESSA'; // Literal REMESSA
    headerLine += '01'; // Código do serviço (01 = Cobrança)
    headerLine += padRight('PAGAMENTO', 15); // Literal de serviço
    headerLine += padLeft(settings.cnpj.replace(/\D/g, ''), 20); // CNPJ da empresa
    headerLine += padRight(settings.company_name.substring(0, 30), 30); // Nome da empresa
    headerLine += '237'; // Código do banco (237 = Bradesco)
    headerLine += padRight('BRADESCO', 15); // Nome do banco
    headerLine += todayStr; // Data de geração
    headerLine += padLeft('', 8, ' '); // Brancos
    headerLine += 'MX'; // Identificação do sistema
    headerLine += padLeft('1', 7); // Número sequencial do arquivo
    headerLine += padLeft('', 277, ' '); // Complemento do registro
    headerLine += '000001'; // Número sequencial do registro
    cnabLines.push(headerLine);

    // Detalhes (Registro 1) - um para cada nota fiscal
    invoices.forEach((invoice, index) => {
      let detailLine = '1'; // Tipo de registro
      detailLine += padLeft('', 5, ' '); // Brancos
      detailLine += '0'; // Zeros
      detailLine += padLeft('', 12, ' '); // Brancos
      detailLine += '0'; // Zeros
      detailLine += padLeft('', 3, ' '); // Brancos
      detailLine += '0'; // Zeros
      detailLine += padLeft(invoice.supplier_cnpj.replace(/\D/g, ''), 14); // CNPJ/CPF do fornecedor
      detailLine += padRight(invoice.supplier_name.substring(0, 40), 40); // Nome do fornecedor
      detailLine += padLeft('', 40, ' '); // Endereço (não usado)
      detailLine += padLeft('', 12, ' '); // Bairro (não usado)
      detailLine += padLeft('', 8, ' '); // CEP (não usado)
      detailLine += padLeft('', 15, ' '); // Cidade (não usado)
      detailLine += padLeft('', 2, ' '); // UF (não usado)
      detailLine += formatDate(invoice.invoice_date || today.toISOString()); // Data de pagamento
      detailLine += formatCurrency(invoice.net_amount); // Valor líquido a pagar
      detailLine += padLeft('', 10, ' '); // Brancos
      detailLine += padLeft(invoice.invoice_number || '', 10); // Número da nota fiscal
      detailLine += padLeft('', 110, ' '); // Complemento do registro
      detailLine += padLeft(String(index + 2), 6); // Número sequencial do registro
      cnabLines.push(detailLine);
    });

    // Trailer (Registro 9)
    let trailerLine = '9'; // Tipo de registro
    trailerLine += padLeft(String(invoices.length), 6); // Quantidade de registros
    trailerLine += formatCurrency(invoices.reduce((sum, inv) => sum + Number(inv.net_amount), 0)); // Valor total
    trailerLine += padLeft('', 374, ' '); // Complemento do registro
    trailerLine += padLeft(String(invoices.length + 2), 6); // Número sequencial do registro
    cnabLines.push(trailerLine);

    const cnabContent = cnabLines.join('\n');

    // Update invoices as CNAB generated
    await supabase
      .from('incoming_invoices')
      .update({ 
        cnab_generated: true, 
        cnab_generated_at: new Date().toISOString() 
      })
      .in('id', invoiceIds);

    console.log('CNAB gerado com sucesso para', invoices.length, 'notas fiscais');

    return new Response(
      JSON.stringify({ 
        success: true,
        cnabContent,
        fileName: `CNAB_BRADESCO_${todayStr}.rem`,
        invoiceCount: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + Number(inv.net_amount), 0)
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