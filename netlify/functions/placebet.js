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
    
    console.log('📡 Proxying bet placement request');
    console.log('📝 Event body type:', typeof event.body);
    console.log('📝 Event body isBase64Encoded:', event.isBase64Encoded);
    
    // Handle body - it might be base64 encoded
    let bodyToSend = event.body;
    if (event.isBase64Encoded) {
      bodyToSend = Buffer.from(event.body, 'base64').toString('utf-8');
      console.log('📝 Decoded from base64');
    }
    
    console.log('📝 Body length:', bodyToSend ? bodyToSend.length : 0);
    console.log('📝 First 200 chars:', bodyToSend ? bodyToSend.substring(0, 200) : 'EMPTY');
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: bodyToSend,
    });

    const data = await response.json();
    
    console.log('✅ Response received, ticketNo:', data.ticketNo || 'none');
    console.log('✅ Response received, errorMessage:', data.errorMessage || 'none');
    
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
