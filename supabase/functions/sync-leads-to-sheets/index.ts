import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadData {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  role: string;
  city: string;
  state: string;
  marketing_accepted: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleServiceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const googleSheetsId = Deno.env.get('GOOGLE_SHEETS_ID');

    if (!googleServiceAccountKey || !googleSheetsId) {
      console.error('Missing Google Sheets configuration');
      return new Response(
        JSON.stringify({ error: 'Google Sheets not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const leadData: LeadData = await req.json();
    console.log('Received lead data:', { email: leadData.email, full_name: leadData.full_name });

    // Parse the service account key
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(googleServiceAccountKey);
    } catch (e) {
      console.error('Failed to parse service account key:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid service account key format' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate JWT for Google Sheets API
    const jwt = await generateGoogleJWT(serviceAccount);
    
    // Get access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Failed to get access token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with Google' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Prepare row data for Google Sheets
    const now = new Date();
    const formattedDate = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    const rowData = [
      formattedDate,
      leadData.full_name,
      leadData.email,
      leadData.phone || '',
      leadData.company_name || '',
      leadData.role || '',
      leadData.city || '',
      leadData.state || '',
      leadData.marketing_accepted ? 'Sim' : 'Não',
      'Novo', // Status for SDR
    ];

    // Append row to Google Sheets
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetsId}/values/Leads!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData],
        }),
      }
    );

    if (!sheetsResponse.ok) {
      const sheetsError = await sheetsResponse.text();
      console.error('Failed to append to Google Sheets:', sheetsError);
      return new Response(
        JSON.stringify({ error: 'Failed to sync to Google Sheets' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const sheetsResult = await sheetsResponse.json();
    console.log('Successfully synced lead to Google Sheets:', sheetsResult.updates?.updatedRange);

    // Update the lead as synced in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from('waitlist_leads')
      .update({ synced_to_sheets: true })
      .eq('email', leadData.email)
      .order('created_at', { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ success: true, message: 'Lead synced to Google Sheets' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in sync-leads-to-sheets function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to generate JWT for Google APIs
async function generateGoogleJWT(serviceAccount: { client_email: string; private_key: string }) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key and sign
  const privateKey = serviceAccount.private_key;
  const signature = await signWithRS256(signatureInput, privateKey);

  return `${signatureInput}.${signature}`;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signWithRS256(data: string, privateKeyPem: string): Promise<string> {
  // Clean up the PEM key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(data)
  );

  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
