import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get role level
function getRoleLevel(role: string | null): number {
  const levels: Record<string, number> = {
    'SUPERADMIN': 5,
    'ADMIN': 4,
    'FINANCEIRO': 3,
    'CONTADOR': 3,
    'FISCAL': 2,
    'USUARIO': 1,
    'VIEWER': 1
  };
  return levels[role || ''] || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ✅ Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Verify user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Require ADMIN role minimum for phone lookups
    const { data: callerRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    
    const roleLevel = getRoleLevel(callerRole?.role)
    if (roleLevel < 4) { // ADMIN or higher
      return new Response(
        JSON.stringify({ error: 'Permissões insuficientes. Requer role ADMIN ou superior.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Add audit logging for phone lookups
    console.log(`Phone lookup by user ${user.id} (role: ${callerRole?.role})`)

    // Validate input
    const requestSchema = z.object({
      phoneNumber: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/, 'Formato de telefone inválido')
    });

    const body = await req.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { phoneNumber } = validation.data;

    console.log('Buscando usuário por telefone:', phoneNumber)

    // Buscar perfil por telefone
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile) {
      console.log('Usuário não encontrado')
      return new Response(
        JSON.stringify({ userId: null, userName: null, userRole: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar role do usuário
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (roleError) {
      console.error('Erro ao buscar role:', roleError)
    }

    console.log('Usuário encontrado:', profile.full_name)

    return new Response(
      JSON.stringify({
        userId: profile.id,
        userName: profile.full_name,
        userRole: roleData?.role || 'VIEWER',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
