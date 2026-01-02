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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: TestResult[] = [];
  
  try {
    // Get credentials from environment
    const token = Deno.env.get('TECNOSPEED_TOKEN');
    const loginAuth = Deno.env.get('TECNOSPEED_LOGIN_AUTH');
    
    console.log('=== TecnoSpeed Connection Test ===');
    console.log('Token configured:', !!token);
    console.log('LoginAuth configured:', !!loginAuth);
    
    if (!token || !loginAuth) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais não configuradas',
        details: {
          tokenConfigured: !!token,
          loginAuthConfigured: !!loginAuth
        },
        recommendations: [
          'Configure TECNOSPEED_TOKEN nas secrets do Supabase',
          'Configure TECNOSPEED_LOGIN_AUTH nas secrets do Supabase'
        ]
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Environment detection
    const isProduction = Deno.env.get('TECNOSPEED_ENVIRONMENT') === 'production';
    
    // Base URLs to test - TecnoSpeed official endpoints
    const baseUrls = isProduction ? [
      'https://api.openfinance.tecnospeed.com.br',
      'https://openfinance.tecnospeed.com.br',
    ] : [
      'https://api.sandbox.openfinance.tecnospeed.com.br',
      'https://sandbox.openfinance.tecnospeed.com.br',
      'https://api.openfinance.tecnospeed.com.br', // fallback to production for testing
    ];

    // Auth methods to test
    const authMethods: Array<{ name: string; headers: Record<string, string> }> = [
      {
        name: 'Bearer + LoginAuth Header',
        headers: {
          'Authorization': `Bearer ${token}`,
          'LoginAuth': loginAuth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      {
        name: 'Basic Auth (cnpj:token)',
        headers: {
          'Authorization': `Basic ${btoa(`${loginAuth}:${token}`)}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      {
        name: 'Token Header Only',
        headers: {
          'Token': token,
          'CNPJ': loginAuth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    ];

    // Endpoints to test
    const endpoints = [
      '/v1/status',
      '/v1/health',
      '/status',
      '/health'
    ];

    // Test each combination (limited to avoid too many requests)
    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints.slice(0, 3)) {
        for (const auth of authMethods.slice(0, 2)) {
          const url = `${baseUrl}${endpoint}`;
          const testStart = Date.now();
          
          try {
            console.log(`Testing: ${auth.name} -> ${url}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            const response = await fetch(url, {
              method: 'GET',
              headers: auth.headers,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const latencyMs = Date.now() - testStart;
            let responseBody: unknown;
            
            // Clone response before reading body to avoid "Body already consumed" error
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

            const result: TestResult = {
              method: auth.name,
              endpoint: url,
              status: response.status,
              success: response.ok,
              response: responseBody,
              latencyMs
            };

            results.push(result);
            
            console.log(`Result: ${response.status} - ${response.ok ? 'SUCCESS' : 'FAILED'}`);
            
            // If we found a working combination, log it prominently
            if (response.ok) {
              console.log('✅ WORKING AUTH METHOD FOUND!');
              console.log('Method:', auth.name);
              console.log('URL:', url);
            }
          } catch (error) {
            const latencyMs = Date.now() - testStart;
            results.push({
              method: auth.name,
              endpoint: url,
              status: 0,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              latencyMs
            });
            console.log(`Error: ${error}`);
          }
        }
      }
    }

    // Analyze results
    const successfulTests = results.filter(r => r.success);
    const authErrors = results.filter(r => r.status === 401 || r.status === 403);
    const networkErrors = results.filter(r => r.status === 0);
    const notFoundErrors = results.filter(r => r.status === 404);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (successfulTests.length > 0) {
      recommendations.push(`Método de autenticação funcional encontrado: ${successfulTests[0].method}`);
      recommendations.push(`Endpoint funcional: ${successfulTests[0].endpoint}`);
    } else if (authErrors.length > 0) {
      recommendations.push('Credenciais parecem inválidas - verifique TECNOSPEED_TOKEN e TECNOSPEED_LOGIN_AUTH');
      recommendations.push('Confirme se as credenciais são para ambiente de produção ou homologação');
    } else if (notFoundErrors.length === results.length) {
      recommendations.push('Nenhum endpoint encontrado - verifique a URL base da API TecnoSpeed');
      recommendations.push('Consulte a documentação oficial em https://atendimento.tecnospeed.com.br');
    } else if (networkErrors.length > 0) {
      recommendations.push('Erros de rede detectados - verifique se a API está acessível');
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
          user_id: '00000000-0000-0000-0000-000000000000', // System user
          user_role: 'SUPERADMIN',
          action: 'tecnospeed_connection_test',
          details: JSON.stringify({
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
      summary: {
        totalTests: results.length,
        successful: successfulTests.length,
        authErrors: authErrors.length,
        notFound: notFoundErrors.length,
        networkErrors: networkErrors.length,
        totalTimeMs: totalTime
      },
      workingMethod: successfulTests.length > 0 ? {
        method: successfulTests[0].method,
        endpoint: successfulTests[0].endpoint,
        latencyMs: successfulTests[0].latencyMs
      } : null,
      recommendations,
      results: results.slice(0, 20), // Limit results in response
      credentials: {
        tokenConfigured: !!token,
        tokenLength: token?.length ?? 0,
        loginAuthConfigured: !!loginAuth,
        loginAuthLength: loginAuth?.length ?? 0
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
