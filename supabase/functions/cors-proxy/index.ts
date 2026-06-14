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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With, Cookie',
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

    // Extract cookies from the request to forward to target API
    const cookies = req.headers.get('cookie') || ''
    const referer = req.headers.get('referer') || ''
    const origin = req.headers.get('origin') || ''

    // Build headers to forward - only include necessary ones
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Football-PWA/1.0',
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    }

    // Forward cookies if present (critical for authentication)
    if (cookies) {
      forwardHeaders['Cookie'] = cookies
    }

    // Forward referer for security checks
    if (referer) {
      forwardHeaders['Referer'] = referer
    }

    // Fetch from target API (server-to-server, no CORS)
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    })

    // Get response data
    const data = await response.text()

    // Extract Set-Cookie headers from response to forward back to client
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    }

    // Forward Set-Cookie headers back to client
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      responseHeaders['Set-Cookie'] = setCookie
    }

    // Return with CORS headers
    return new Response(data, {
      status: response.status,
      headers: responseHeaders,
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
