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
  hint?: string;
}

interface HeaderVariant {
  name: string;
  headers: Record<string, string>;
}

// Get base URL based on environment
function getBaseUrl(env: string): string {
  return env === 'production' 
    ? 'https://api.pagamentobancario.com.br/api/v1'
    : 'https://staging.pagamentobancario.com.br/api/v1';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: TestResult[] = [];
  
  try {
    // Parse request body
    let payerCpfCnpj: string | null = null;
    let companyCnpj: string | null = null;
    let testEnvironment: string | null = null;
    
    try {
      const body = await req.json();
      payerCpfCnpj = body?.payerCpfCnpj || null;
      testEnvironment = body?.environment || null; // Allow overriding environment for testing
    } catch {
      // No body or invalid JSON, that's ok
    }
    
    // Try to get company CNPJ from user's profile if authenticated
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
    
    // Get credentials
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
    
    // Clean CNPJ and validate
    const cnpjClean = CNPJ_SH.replace(/\D/g, '');
    const cnpjFormatted = CNPJ_SH.replace(/[^\d./\-]/g, ''); // Keep only digits and formatting
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

    // Define header variants to test
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

    // Test /account endpoint with each header variant
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
        
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
        
        const status = response.status;
        const success = status >= 200 && status < 300;
        
        // Extract message from response
        let message: string | undefined;
        let hint: string | undefined;
        const responseObj = responseBody as Record<string, unknown> || {};
        
        if (responseObj.message) message = String(responseObj.message);
        else if (responseObj.error) message = String(responseObj.error);
        else if (responseObj.msg) message = String(responseObj.msg);
        
        const bodyStr = JSON.stringify(responseBody || {}).toLowerCase();
        
        let errorType: TestResult['errorType'];
        if (status === 401 || status === 403) {
          errorType = 'auth';
          hint = 'Credenciais rejeitadas pela API';
        } else if (status === 422) {
          // Check if it's really an auth issue
          // For /account endpoint, 422 with "payercpfcnpj" message indicates auth rejection
          // because /account doesn't require payercpfcnpj
          const mentionsPayerCnpj = bodyStr.includes('payercpfcnpj') || bodyStr.includes('payer') || bodyStr.includes('obrigat');
          const mentionsAuthHeaders = bodyStr.includes('cnpjsh') || bodyStr.includes('tokensh');
          
          if (mentionsAuthHeaders || mentionsPayerCnpj) {
            errorType = 'auth';
            hint = 'API rejeitou credenciais - verifique token/CNPJ no TecnoAccount';
          } else {
            errorType = 'validation';
            hint = 'Erro de validação de dados';
          }
        } else if (status === 404) {
          errorType = 'not_found';
        } else if (status >= 500) {
          errorType = 'server';
          hint = 'Erro interno no servidor TecnoSpeed';
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
          hint
        };
        
        results.push(result);
        
        console.log(`  -> Status: ${status}, Success: ${success}`);
        
        if (success && !workingVariant) {
          workingVariant = variant.name;
          firstSuccessResult = result;
          console.log(`✅ Working variant found: ${variant.name}`);
        }
        
        // If we found a working variant, no need to test more
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

    // If we found a working variant, test /payer endpoint with it
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
          
          results.push({
            method: 'GET /payer',
            endpoint: url,
            status,
            success,
            response: responseBody,
            latencyMs,
            errorType: status === 404 ? 'not_found' : status >= 400 ? 'validation' : undefined,
            headerVariant: workingVariant
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

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (workingVariant) {
      recommendations.push(`✅ Conexão funcionando com headers: ${workingVariant}`);
      recommendations.push('A integração está pronta para uso');
    } else if (networkErrors.length === results.length) {
      recommendations.push('❌ Erro de rede em todos os testes');
      recommendations.push(`Verifique se a URL está acessível: ${baseUrl}`);
    } else if (authErrors.length > 0 || results.every(r => !r.success)) {
      recommendations.push('❌ Nenhuma variante de header funcionou');
      recommendations.push('');
      recommendations.push('🔍 Possíveis causas:');
      recommendations.push('1. Token não está vinculado ao CNPJ da Software House no TecnoAccount');
      recommendations.push('2. Conta da Software House não está ativa no ambiente ' + env);
      recommendations.push('3. Token expirado ou inválido');
      recommendations.push('');
      recommendations.push('📋 Ações recomendadas:');
      recommendations.push('1. Acesse https://conta.tecnospeed.com.br');
      recommendations.push('2. Verifique se a conta está ativa');
      recommendations.push('3. Confirme o token para o ambiente: ' + env);
      recommendations.push('4. Verifique se o CNPJ da Software House está correto');
      recommendations.push('5. Entre em contato com suporte TecnoSpeed se o problema persistir');
    } else if (validationErrors.length > 0) {
      recommendations.push('⚠️ Credenciais parecem OK, mas há erros de validação');
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
