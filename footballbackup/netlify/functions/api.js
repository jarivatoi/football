// Netlify Function to proxy all Totelepep API requests
// This avoids CORS issues by running server-side

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the endpoint from query parameters
    const { endpoint } = event.queryStringParameters;
    
    if (!endpoint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing endpoint parameter' })
      };
    }

    // Decode the endpoint
    const decodedEndpoint = decodeURIComponent(endpoint);
    const targetUrl = `https://www.totelepep.mu/${decodedEndpoint}`;
    
    console.log('📡 Proxying API request to:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const data = await response.json();
    
    console.log('✅ Received response from Totelepep API');
    
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
