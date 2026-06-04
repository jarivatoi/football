// Netlify Function to proxy bet placement requests
// This avoids CORS issues by running server-side

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Forward the request to Totelepep API
    const targetUrl = 'https://www.totelepep.mu/webapi/placebet';
    
    console.log('📡 Proxying bet placement request to:', targetUrl);
    console.log('📝 Event body type:', typeof event.body);
    console.log('📝 Event body:', event.body);
    console.log('📝 Event body length:', event.body ? event.body.length : 0);
    console.log('📝 Content-Type header:', event.headers['content-type']);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: event.body,
    });

    const data = await response.json();
    
    console.log('✅ Received response from Totelepep API:', JSON.stringify(data).substring(0, 200));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('❌ Proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Proxy error', 
        message: error.message 
      }),
    };
  }
};
