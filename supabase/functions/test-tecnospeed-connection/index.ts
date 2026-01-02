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
}

// Get base URL based on environment
function getBaseUrl(): string {
  const env = Deno.env.get('TECNOSPEED_ENVIRONMENT') || 'staging';
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
    // Parse request body for optional payerCpfCnpj
    let payerCpfCnpj: string | null = null;
    let companyCnpj: string | null = null;
    
    try {
      const body = await req.json();
      payerCpfCnpj = body?.payerCpfCnpj || null;
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
          // Get user's company CNPJ
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
              console.log('Found company CNPJ:', companyCnpj ? companyCnpj.substring(0, 4) + '...' : 'N/A');
            }
          }
        }
      } catch (e) {
        console.log('Could not fetch company CNPJ:', e);
      }
    }
    
    // Use provided payerCpfCnpj or company CNPJ
    const effectivePayerCnpj = payerCpfCnpj?.replace(/\D/g, '') || companyCnpj;
    
    // Get credentials from environment - same as other plugbank functions
    const TOKEN = Deno.env.get('TECNOSPEED_TOKEN');
    const CNPJ_SH = Deno.env.get('TECNOSPEED_CNPJ_SOFTWAREHOUSE');
    const env = Deno.env.get('TECNOSPEED_ENVIRONMENT') || 'staging';
    
    console.log('=== TecnoSpeed Connection Test ===');
    console.log('Environment:', env);
    console.log('Token configured:', !!TOKEN);
    console.log('Token length:', TOKEN?.length ?? 0);
    console.log('CNPJ_SH configured:', !!CNPJ_SH);
    console.log('CNPJ_SH value:', CNPJ_SH ? `${CNPJ_SH.substring(0, 4)}...` : 'N/A');
    console.log('Effective Payer CNPJ:', effectivePayerCnpj ? `${effectivePayerCnpj.substring(0, 4)}...` : 'Not available');
    
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
        recommendations: missingSecrets.map(s => `Configure ${s} nas secrets do Supabase`)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const baseUrl = getBaseUrl();
    console.log('Base URL:', baseUrl);

    // Validate CNPJ format (should be 14 numeric digits)
    const cnpjClean = CNPJ_SH.replace(/\D/g, '');
    const cnpjValid = cnpjClean.length === 14;
    console.log('CNPJ clean (digits only):', cnpjClean.length, 'digits');
    console.log('CNPJ format valid:', cnpjValid);
    
    if (!cnpjValid) {
      console.warn('CNPJ format invalid! Expected 14 digits, got:', cnpjClean.length);
    }

    // Log the exact headers being sent (masked for security)
    console.log('=== Headers Being Sent ===');
    console.log('cnpjsh:', cnpjClean.substring(0, 4) + '****' + cnpjClean.substring(cnpjClean.length - 2));
    console.log('tokensh:', TOKEN.substring(0, 4) + '****' + TOKEN.substring(TOKEN.length - 4));

    // Standard headers - same as other plugbank functions (use clean CNPJ)
    const standardHeaders = {
      'Content-Type': 'application/json',
      'cnpjsh': cnpjClean,
      'tokensh': TOKEN,
    };

    // Build endpoints to test
    const endpoints: Array<{ path: string; method: string; name: string; requiresPayerCnpj: boolean }> = [];
    
    // First test: /account endpoint (doesn't require payer CNPJ, good for auth test)
    endpoints.push({ 
      path: '/account', 
      method: 'GET', 
      name: 'Listar Contas (Teste de Auth)', 
      requiresPayerCnpj: false 
    });
    
    // Second test: /payer with CNPJ if available
    if (effectivePayerCnpj) {
      endpoints.push({ 
        path: `/payer?payercpfcnpj=${effectivePayerCnpj}`, 
        method: 'GET', 
        name: 'Buscar Pagador por CNPJ',
        requiresPayerCnpj: true
      });
    }

    // Test each endpoint
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint.path}`;
      const testStart = Date.now();
      
      try {
        console.log(`Testing: ${endpoint.name} -> ${endpoint.method} ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const response = await fetch(url, {
          method: endpoint.method,
          headers: standardHeaders,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - testStart;
        let responseBody: unknown;
        
        const responseClone = response.clone();
        try {
          responseBody = await response.json();
        } catch {
          try {
            responseBody = await responseClone.text();
          } catch {
            responseBody = 'Unable to read response body';
          }
        }

        // Classify error types properly
        let errorType: TestResult['errorType'] = undefined;
        const status = response.status;
        
        console.log(`Response status: ${status}, body:`, JSON.stringify(responseBody).substring(0, 200));
        
        // Analyze response body for specific error patterns
        const bodyStr = JSON.stringify(responseBody || {}).toLowerCase();
        const hasPayerCnpjError = bodyStr.includes('payercpfcnpj') && (bodyStr.includes('obrigatório') || bodyStr.includes('required'));
        
        if (status === 0) {
          errorType = 'network';
        } else if (status === 401 || status === 403) {
          errorType = 'auth';
        } else if (status === 422) {
          // 422 can mean validation OR auth issues depending on context
          // If we sent payercpfcnpj but still got "required" error, it's likely an auth issue
          if (hasPayerCnpjError && endpoint.requiresPayerCnpj && effectivePayerCnpj) {
            console.log('⚠️ 422 with payercpfcnpj error even though we sent the param - likely auth header issue');
            errorType = 'auth'; // Treat as auth error if we sent the param but API says it's missing
          } else {
            errorType = 'validation';
          }
        } else if (status === 404) {
          errorType = 'not_found';
        } else if (status >= 500) {
          errorType = 'server';
        }

        const authWorks = status >= 200 && status < 300;
        // 404 means auth passed but resource not found
        // 422 validation (not auth-related) means auth passed but params missing
        const credentialsOk = authWorks || status === 404 || (status === 422 && errorType === 'validation');

        const result: TestResult = {
          method: `${endpoint.method} ${endpoint.name}`,
          endpoint: url,
          status: response.status,
          success: authWorks,
          response: responseBody,
          latencyMs,
          errorType
        };

        results.push(result);
        
        const statusLabel = authWorks ? 'SUCCESS' : 
                           errorType === 'auth' ? 'AUTH_ERROR' :
                           errorType === 'validation' ? 'VALIDATION' : 
                           errorType === 'not_found' ? 'NOT_FOUND' : 'FAILED';
        console.log(`Result: ${response.status} - ${statusLabel}`);
        
        if (authWorks) {
          console.log('✅ ENDPOINT WORKING!');
        } else if (credentialsOk) {
          console.log('⚠️ Credentials seem OK, but endpoint returned:', status);
        } else if (errorType === 'auth') {
          console.log('❌ Auth error detected - check headers');
        }
      } catch (error) {
        const latencyMs = Date.now() - testStart;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          method: `${endpoint.method} ${endpoint.name}`,
          endpoint: url,
          status: 0,
          success: false,
          error: errorMessage,
          latencyMs,
          errorType: 'network'
        });
        console.log(`Error: ${errorMessage}`);
      }
    }

    // Analyze results with proper classification
    const successfulTests = results.filter(r => r.success);
    const authErrors = results.filter(r => r.errorType === 'auth'); // Only 401/403
    const validationErrors = results.filter(r => r.errorType === 'validation'); // 422
    const notFoundErrors = results.filter(r => r.errorType === 'not_found'); // 404
    const networkErrors = results.filter(r => r.errorType === 'network');
    const serverErrors = results.filter(r => r.errorType === 'server');

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!cnpjValid) {
      recommendations.push(`❌ CNPJ da Software House inválido: esperado 14 dígitos, encontrado ${cnpjClean.length}`);
      recommendations.push('O CNPJ deve conter apenas números (sem pontos, barras ou traços)');
    }
    
    if (successfulTests.length > 0) {
      recommendations.push(`✅ Conexão e credenciais funcionando! ${successfulTests.length} endpoint(s) respondendo`);
    } else if (networkErrors.length === results.length) {
      recommendations.push('❌ Erro de rede - não foi possível conectar à API TecnoSpeed');
      recommendations.push('Verifique se a URL está correta: ' + baseUrl);
    } else if (authErrors.length > 0) {
      // Real auth errors (401/403 OR 422 with param-sent-but-rejected pattern)
      recommendations.push('❌ Problema de autenticação detectado');
      recommendations.push('🔑 Verifique TECNOSPEED_TOKEN e TECNOSPEED_CNPJ_SOFTWAREHOUSE no Lovable Cloud');
      recommendations.push('⚠️ IMPORTANTE: TECNOSPEED_CNPJ_SOFTWAREHOUSE é o CNPJ da Software House (sua empresa de software), não da empresa cliente');
      
      const firstAuthError = authErrors[0];
      if (firstAuthError.response && typeof firstAuthError.response === 'object') {
        const resp = firstAuthError.response as Record<string, unknown>;
        if (resp.message) {
          recommendations.push(`Mensagem da API: ${resp.message}`);
        }
        // Check if the error mentions payercpfcnpj but we sent it
        const errors = resp.errors as Array<{ message?: string }> | undefined;
        if (errors && errors.length > 0) {
          const errorMsg = errors[0].message || '';
          if (errorMsg.toLowerCase().includes('payercpfcnpj') && effectivePayerCnpj) {
            recommendations.push('⚠️ API rejeitou dizendo "payercpfcnpj obrigatório" mas o parâmetro foi enviado');
            recommendations.push('🔍 Isso indica que a API não está aceitando os headers de autenticação (cnpjsh/tokensh)');
          }
        }
      }
      console.log('Auth error details:', JSON.stringify(authErrors[0], null, 2));
    } else if (validationErrors.length > 0) {
      // 422 - Validation errors (missing params, not auth issues)
      const firstValidationError = validationErrors[0];
      let specificMessage = '';
      
      if (firstValidationError.response && typeof firstValidationError.response === 'object') {
        const resp = firstValidationError.response as Record<string, unknown>;
        const errors = resp.errors as Array<{ message?: string }> | undefined;
        
        if (errors && errors.length > 0 && errors[0].message) {
          specificMessage = errors[0].message;
        } else if (resp.message) {
          specificMessage = String(resp.message);
        }
      }
      
      if (specificMessage.toLowerCase().includes('payercpfcnpj')) {
        recommendations.push('⚠️ Credenciais parecem OK, mas falta o CNPJ do pagador (empresa)');
        if (!effectivePayerCnpj) {
          recommendations.push('💡 Cadastre o CNPJ da empresa em Configurações da Empresa');
          recommendations.push('Ou informe o CNPJ no campo de diagnóstico acima');
        }
      } else {
        recommendations.push('⚠️ Erro de validação (422) - parâmetro obrigatório ausente');
        if (specificMessage) {
          recommendations.push(`Detalhe: ${specificMessage}`);
        }
      }
      
      // This is NOT an auth error
      recommendations.push('ℹ️ As credenciais (TOKEN e CNPJ_SH) parecem estar corretas');
      
      console.log('Validation error details:', JSON.stringify(validationErrors[0], null, 2));
    } else if (notFoundErrors.length > 0) {
      // 404 - Resource not found but auth passed
      recommendations.push('✅ Credenciais OK - autenticação passou');
      recommendations.push('⚠️ Recurso não encontrado (404)');
      recommendations.push('💡 Próximo passo: cadastrar pagador/conta no sistema');
    } else if (serverErrors.length > 0) {
      recommendations.push('⚠️ Servidor TecnoSpeed retornando erros 5xx');
      recommendations.push('Pode ser um problema temporário - tente novamente');
    }

    const totalTime = Date.now() - startTime;

    // Log to Supabase if user is authenticated
    if (authHeader) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase.from('audit_logs').insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          user_role: 'SUPERADMIN',
          action: 'tecnospeed_connection_test',
          details: JSON.stringify({
            environment: env,
            baseUrl,
            totalTests: results.length,
            successfulTests: successfulTests.length,
            authErrors: authErrors.length,
            validationErrors: validationErrors.length,
            totalTimeMs: totalTime,
            hasPayerCnpj: !!effectivePayerCnpj
          })
        });
      } catch (logError) {
        console.error('Failed to log audit:', logError);
      }
    }

    // Determine overall success - consider validation errors as "credentials OK but missing data"
    const credentialsWork = successfulTests.length > 0 || validationErrors.length > 0 || notFoundErrors.length > 0;
    const hasAuthIssues = authErrors.length > 0;

    return new Response(JSON.stringify({
      success: successfulTests.length > 0,
      credentialsOk: credentialsWork && !hasAuthIssues,
      environment: env,
      baseUrl,
      payerCnpjUsed: effectivePayerCnpj ? `${effectivePayerCnpj.substring(0, 4)}...` : null,
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
      workingMethod: successfulTests.length > 0 ? {
        method: 'Headers cnpjsh + tokensh',
        endpoint: successfulTests[0].endpoint,
        latencyMs: successfulTests[0].latencyMs
      } : null,
      recommendations,
      results,
      credentials: {
        tokenConfigured: !!TOKEN,
        tokenLength: TOKEN?.length ?? 0,
        cnpjShConfigured: !!CNPJ_SH,
        cnpjShPreview: CNPJ_SH ? `${CNPJ_SH.substring(0, 4)}...` : null
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
