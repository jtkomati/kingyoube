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

    // Standard headers - same as other plugbank functions (use clean CNPJ)
    const standardHeaders = {
      'Content-Type': 'application/json',
      'cnpjsh': cnpjClean,
      'tokensh': TOKEN,
    };

    // Endpoints to test
    const endpoints = [
      { path: '/payer', method: 'GET', name: 'Listar Pagadores' },
      { path: '/account', method: 'GET', name: 'Listar Contas' },
    ];

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

        // Consider 2xx and some 4xx as "connection working" (auth might be the issue, not connectivity)
        const connectionWorks = response.status !== 0;
        const authWorks = response.status >= 200 && response.status < 300;

        const result: TestResult = {
          method: `${endpoint.method} ${endpoint.name}`,
          endpoint: url,
          status: response.status,
          success: authWorks,
          response: responseBody,
          latencyMs
        };

        results.push(result);
        
        console.log(`Result: ${response.status} - ${authWorks ? 'SUCCESS' : connectionWorks ? 'AUTH ERROR' : 'FAILED'}`);
        
        if (authWorks) {
          console.log('✅ ENDPOINT WORKING!');
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
          latencyMs
        });
        console.log(`Error: ${errorMessage}`);
      }
    }

    // Analyze results
    const successfulTests = results.filter(r => r.success);
    const authErrors = results.filter(r => r.status === 401 || r.status === 403 || r.status === 422);
    const networkErrors = results.filter(r => r.status === 0);
    const serverErrors = results.filter(r => r.status >= 500);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (!cnpjValid) {
      recommendations.push(`❌ CNPJ inválido: esperado 14 dígitos, encontrado ${cnpjClean.length}`);
      recommendations.push('O CNPJ deve conter apenas números (sem pontos, barras ou traços)');
    }
    
    if (successfulTests.length > 0) {
      recommendations.push(`✅ Conexão funcionando! ${successfulTests.length} endpoint(s) respondendo`);
    } else if (networkErrors.length === results.length) {
      recommendations.push('❌ Erro de rede - não foi possível conectar à API TecnoSpeed');
      recommendations.push('Verifique se a URL está correta: ' + baseUrl);
    } else if (authErrors.length > 0) {
      recommendations.push('⚠️ Credenciais podem estar inválidas');
      recommendations.push('Verifique TECNOSPEED_TOKEN e TECNOSPEED_CNPJ_SOFTWAREHOUSE');
      
      // Check for specific error messages
      const firstAuthError = authErrors[0];
      if (firstAuthError.response && typeof firstAuthError.response === 'object') {
        const resp = firstAuthError.response as Record<string, unknown>;
        if (resp.message) {
          recommendations.push(`Mensagem da API: ${resp.message}`);
        }
        if (resp.error) {
          recommendations.push(`Erro: ${resp.error}`);
        }
      }
      
      // Log detailed error info
      console.log('Auth error details:', JSON.stringify(authErrors[0], null, 2));
    } else if (serverErrors.length > 0) {
      recommendations.push('⚠️ Servidor TecnoSpeed retornando erros 5xx');
      recommendations.push('Pode ser um problema temporário - tente novamente');
    }

    const totalTime = Date.now() - startTime;

    // Log to Supabase if user is authenticated
    const authHeader = req.headers.get('Authorization');
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
            totalTimeMs: totalTime
          })
        });
      } catch (logError) {
        console.error('Failed to log audit:', logError);
      }
    }

    return new Response(JSON.stringify({
      success: successfulTests.length > 0,
      environment: env,
      baseUrl,
      summary: {
        totalTests: results.length,
        successful: successfulTests.length,
        authErrors: authErrors.length,
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
