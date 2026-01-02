import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  method: string;
  endpoint: string;
  status: number;
  success: boolean;
  response?: unknown;
  error?: string;
  latencyMs: number;
  errorType?: 'auth' | 'validation' | 'network' | 'server' | 'not_found';
  headerVariant?: string;
  message?: string;
  internalCode?: string | number;
  responseSnippet?: string;
}

interface HeaderVariant {
  name: string;
  headers: Record<string, string>;
}

function getBaseUrl(env: string): string {
  return env === 'production' 
    ? 'https://api.pagamentobancario.com.br/api/v1'
    : 'https://staging.pagamentobancario.com.br/api/v1';
}

// Extract the most useful error message from API response
function extractErrorMessage(responseBody: unknown): { message?: string; internalCode?: string | number } {
  if (!responseBody || typeof responseBody !== 'object') {
    return {};
  }
  
  const obj = responseBody as Record<string, unknown>;
  
  // Priority 1: errors array (TecnoSpeed pattern)
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const firstError = obj.errors[0] as Record<string, unknown>;
    return {
      message: firstError.message ? String(firstError.message) : undefined,
      internalCode: firstError.internalCode as string | number | undefined
    };
  }
  
  // Priority 2: Direct message/error/msg fields
  const message = obj.message || obj.error || obj.msg;
  return {
    message: message ? String(message) : undefined
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: TestResult[] = [];
  
  try {
    let payerCpfCnpj: string | null = null;
    let companyCnpj: string | null = null;
    let testEnvironment: string | null = null;
    
    try {
      const body = await req.json();
      payerCpfCnpj = body?.payerCpfCnpj || null;
      testEnvironment = body?.environment || null;
    } catch {
      // No body or invalid JSON
    }
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader && !payerCpfCnpj) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        );
        
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', userData.user.id)
            .single();
          
          if (profile?.company_id) {
            const { data: company } = await supabase
              .from('company_settings')
              .select('cnpj, plugbank_payer_id')
              .eq('id', profile.company_id)
              .single();
            
            if (company?.cnpj) {
              companyCnpj = company.cnpj.replace(/\D/g, '');
            }
          }
        }
      } catch (e) {
        console.log('Could not fetch company CNPJ:', e);
      }
    }
    
    const effectivePayerCnpj = payerCpfCnpj?.replace(/\D/g, '') || companyCnpj;
    
    const TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    const CNPJ_SH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');
    const defaultEnv = Deno.env.get('TECNOSPEED_ENVIRONMENT') || 'staging';
    const env = testEnvironment || defaultEnv;
    
    console.log('=== TecnoSpeed Connection Test ===');
    console.log('Environment:', env, testEnvironment ? '(override)' : '(default)');
    console.log('Token configured:', !!TOKEN);
    console.log('CNPJ_SH configured:', !!CNPJ_SH);
    
    if (!TOKEN || !CNPJ_SH) {
      const missingSecrets: string[] = [];
      if (!TOKEN) missingSecrets.push('TECNOSPEED_TOKEN');
      if (!CNPJ_SH) missingSecrets.push('TECNOSPEED_CNPJ_SOFTWAREHOUSE');
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais não configuradas',
        details: {
          tokenConfigured: !!TOKEN,
          cnpjShConfigured: !!CNPJ_SH,
          missingSecrets
        },
        recommendations: [
          ...missingSecrets.map(s => `Configure ${s} nas secrets do Lovable Cloud`),
          '📋 Acesse https://conta.tecnospeed.com.br para obter suas credenciais'
        ]
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const baseUrl = getBaseUrl(env);
    
    const cnpjClean = CNPJ_SH.replace(/\D/g, '');
    const cnpjFormatted = CNPJ_SH.replace(/[^\d./\-]/g, '');
    const cnpjValid = cnpjClean.length === 14;
    
    console.log('CNPJ clean:', cnpjClean.length, 'digits');
    console.log('CNPJ valid:', cnpjValid);
    
    if (!cnpjValid) {
      return new Response(JSON.stringify({
        success: false,
        error: `CNPJ da Software House inválido: esperado 14 dígitos, encontrado ${cnpjClean.length}`,
        recommendations: [
          'O CNPJ deve ter exatamente 14 dígitos numéricos',
          `Valor atual (mascarado): ${cnpjClean.substring(0, 4)}...${cnpjClean.substring(cnpjClean.length - 2)}`,
          'Atualize TECNOSPEED_CNPJ_SOFTWAREHOUSE nas secrets do Lovable Cloud'
        ]
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headerVariants: HeaderVariant[] = [
      {
        name: 'lowercase (cnpjsh/tokensh)',
        headers: {
          'Content-Type': 'application/json',
          'cnpjsh': cnpjClean,
          'tokensh': TOKEN,
        }
      },
      {
        name: 'camelCase (cnpjSh/tokenSh)',
        headers: {
          'Content-Type': 'application/json',
          'cnpjSh': cnpjClean,
          'tokenSh': TOKEN,
        }
      },
      {
        name: 'UPPERCASE (CNPJSH/TOKENSH)',
        headers: {
          'Content-Type': 'application/json',
          'CNPJSH': cnpjClean,
          'TOKENSH': TOKEN,
        }
      },
      {
        name: 'with-dash (cnpj-sh/token-sh)',
        headers: {
          'Content-Type': 'application/json',
          'cnpj-sh': cnpjClean,
          'token-sh': TOKEN,
        }
      },
      {
        name: 'formatted CNPJ',
        headers: {
          'Content-Type': 'application/json',
          'cnpjsh': cnpjFormatted,
          'tokensh': TOKEN,
        }
      }
    ];

    console.log(`Testing ${headerVariants.length} header variants...`);
    
    let workingVariant: string | null = null;
    let firstSuccessResult: TestResult | null = null;

    for (const variant of headerVariants) {
      const url = `${baseUrl}/account`;
      const testStart = Date.now();
      
      try {
        console.log(`Testing variant: ${variant.name}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: variant.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const latencyMs = Date.now() - testStart;
        let responseBody: unknown;
        let responseText = '';
        
        try {
          responseText = await response.text();
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = null;
        }
        
        const status = response.status;
        const success = status >= 200 && status < 300;
        
        // Extract error message properly
        const { message, internalCode } = extractErrorMessage(responseBody);
        
        // Create response snippet for debugging (first 400 chars, no secrets)
        const responseSnippet = responseText.length > 400 
          ? responseText.substring(0, 400) + '...' 
          : responseText;
        
        // Simple error classification: only 401/403 are auth errors
        let errorType: TestResult['errorType'];
        if (status === 401 || status === 403) {
          errorType = 'auth';
        } else if (status === 422) {
          errorType = 'validation';
        } else if (status === 404) {
          errorType = 'not_found';
        } else if (status >= 500) {
          errorType = 'server';
        }
        
        const result: TestResult = {
          method: 'GET /account',
          endpoint: url,
          status,
          success,
          response: responseBody,
          latencyMs,
          errorType,
          headerVariant: variant.name,
          message,
          internalCode,
          responseSnippet: status >= 400 ? responseSnippet : undefined
        };
        
        results.push(result);
        
        console.log(`  -> Status: ${status}, Success: ${success}, Message: ${message || 'N/A'}`);
        
        if (success && !workingVariant) {
          workingVariant = variant.name;
          firstSuccessResult = result;
          console.log(`✅ Working variant found: ${variant.name}`);
        }
        
        if (workingVariant) break;
        
      } catch (error) {
        const latencyMs = Date.now() - testStart;
        results.push({
          method: 'GET /account',
          endpoint: url,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          latencyMs,
          errorType: 'network',
          headerVariant: variant.name
        });
      }
    }

    // Test /payer if we have a working variant and payer CNPJ
    if (workingVariant && effectivePayerCnpj) {
      const workingHeaders = headerVariants.find(v => v.name === workingVariant)?.headers;
      if (workingHeaders) {
        const url = `${baseUrl}/payer?payercpfcnpj=${effectivePayerCnpj}`;
        const testStart = Date.now();
        
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: workingHeaders
          });
          
          const latencyMs = Date.now() - testStart;
          let responseBody: unknown;
          try { responseBody = await response.json(); } catch { responseBody = null; }
          
          const status = response.status;
          const success = status >= 200 && status < 300;
          const { message, internalCode } = extractErrorMessage(responseBody);
          
          results.push({
            method: 'GET /payer',
            endpoint: url,
            status,
            success,
            response: responseBody,
            latencyMs,
            errorType: status === 404 ? 'not_found' : status >= 400 ? 'validation' : undefined,
            headerVariant: workingVariant,
            message,
            internalCode
          });
          
        } catch (error) {
          results.push({
            method: 'GET /payer',
            endpoint: url,
            status: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - testStart,
            errorType: 'network',
            headerVariant: workingVariant
          });
        }
      }
    }

    // Analyze results
    const successfulTests = results.filter(r => r.success);
    const authErrors = results.filter(r => r.errorType === 'auth');
    const validationErrors = results.filter(r => r.errorType === 'validation');
    const notFoundErrors = results.filter(r => r.errorType === 'not_found');
    const networkErrors = results.filter(r => r.errorType === 'network');
    const serverErrors = results.filter(r => r.errorType === 'server');
    const status422Count = results.filter(r => r.status === 422).length;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (workingVariant) {
      recommendations.push(`✅ Conexão funcionando com headers: ${workingVariant}`);
      recommendations.push('A integração está pronta para uso');
    } else if (networkErrors.length === results.length) {
      recommendations.push('❌ Erro de rede em todos os testes');
      recommendations.push(`Verifique se a URL está acessível: ${baseUrl}`);
    } else if (authErrors.length > 0) {
      recommendations.push('❌ Credenciais rejeitadas (401/403)');
      recommendations.push('');
      recommendations.push('🔍 Possíveis causas:');
      recommendations.push('1. Token inválido ou expirado');
      recommendations.push('2. CNPJ da Software House incorreto');
      recommendations.push('');
      recommendations.push('📋 Ações recomendadas:');
      recommendations.push('1. Acesse https://conta.tecnospeed.com.br');
      recommendations.push('2. Regenere o token para o ambiente: ' + env);
    } else if (status422Count === results.length) {
      // All tests returned 422 - this is the most common scenario
      const sampleMessage = results[0]?.message;
      recommendations.push('⚠️ API retornou 422 em todos os testes');
      recommendations.push('');
      
      if (sampleMessage) {
        recommendations.push(`📝 Mensagem da API: "${sampleMessage}"`);
        recommendations.push('');
      }
      
      recommendations.push('🔍 Possíveis causas:');
      recommendations.push('1. Token não está vinculado ao CNPJ da Software House');
      recommendations.push('2. Conta não está ativa no ambiente ' + env);
      recommendations.push('3. Endpoint /account pode não ser suportado');
      recommendations.push('');
      recommendations.push('📋 Ações recomendadas:');
      recommendations.push('1. Acesse https://conta.tecnospeed.com.br');
      recommendations.push('2. Verifique se o token está correto para o ambiente: ' + env);
      recommendations.push('3. Confirme que a conta está ativa');
      recommendations.push('4. Entre em contato com suporte TecnoSpeed');
    } else if (validationErrors.length > 0) {
      recommendations.push('⚠️ Erros de validação (422)');
      if (!effectivePayerCnpj) {
        recommendations.push('💡 Informe o CNPJ do pagador para testes completos');
      }
    }

    const totalTime = Date.now() - startTime;
    const credentialsWork = successfulTests.length > 0 || notFoundErrors.length > 0;

    return new Response(JSON.stringify({
      success: successfulTests.length > 0,
      credentialsOk: credentialsWork,
      environment: env,
      baseUrl,
      payerCnpjUsed: effectivePayerCnpj ? `${effectivePayerCnpj.substring(0, 4)}...` : null,
      workingHeaderVariant: workingVariant,
      testedVariants: headerVariants.map(v => v.name),
      summary: {
        totalTests: results.length,
        successful: successfulTests.length,
        authErrors: authErrors.length,
        validationErrors: validationErrors.length,
        status422Count,
        notFoundErrors: notFoundErrors.length,
        networkErrors: networkErrors.length,
        serverErrors: serverErrors.length,
        totalTimeMs: totalTime
      },
      workingMethod: firstSuccessResult ? {
        method: `Headers ${workingVariant}`,
        endpoint: firstSuccessResult.endpoint,
        latencyMs: firstSuccessResult.latencyMs
      } : null,
      recommendations,
      results,
      credentials: {
        tokenConfigured: true,
        tokenLength: TOKEN.length,
        cnpjShConfigured: true,
        cnpjShPreview: `${cnpjClean.substring(0, 4)}...${cnpjClean.substring(cnpjClean.length - 2)}`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
