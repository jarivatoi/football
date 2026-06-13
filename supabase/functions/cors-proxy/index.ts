// Follow these setup instructions:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link to your project: supabase link --project-ref YOUR_PROJECT_REF
// 4. Deploy: supabase functions deploy cors-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const url = new URL(req.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing "url" query parameter' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Fetch from target API (server-to-server, no CORS)
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Football-PWA/1.0',
        ...Object.fromEntries(req.headers),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    })

    // Get response data
    const data = await response.text()

    // Return with CORS headers
    return new Response(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch target URL', details: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
