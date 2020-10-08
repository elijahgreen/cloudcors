const allowedMethods = 'GET, HEAD, POST, OPTIONS';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': allowedMethods,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function handleOptions(request: Request): Response {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Hnalde CORS pre-flight request
    return new Response(null, {
      headers: corsHeaders,
    });
  } else {
    // Handle standard OPTIONS request
    return new Response(null, {
      headers: {
        Allow: allowedMethods,
      },
    });
  }
}

async function handleAllowedMethods(
  endpointUrl: string,
  request: Request,
): Promise<Response> {
  // Rewrite request to point to endpoint url.
  request = new Request(endpointUrl, request);
  // Make server think that this request isn't cross-site
  request.headers.set('Origin', new URL(endpointUrl).origin);

  let response = await fetch(request);

  // Recreate the response so we can modify the headers
  response = new Response(response.body, response);

  response.headers.set('Access-Control-Allow-Origin', '*');

  // Append to/Add Vary header so browser will cache response correctly
  response.headers.append('Vary', 'Origin');

  return response;
}

export async function handleRequest(request: Request): Promise<Response> {
  var originUrl = new URL(request.url);
  var endpointUrl = originUrl.searchParams.get('url');

  if (endpointUrl) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    } else if (allowedMethods.split(', ').includes(request.method)) {
      return handleAllowedMethods(endpointUrl, request);
    } else {
      return new Response(null, {
        status: 405,
        statusText: 'Method Not Allowed',
      });
    }
  } else {
    return new Response(
      'CLOUDFLARE-CORS-PROXY\n\n' + 'Usage:\n' + originUrl.origin + '?url=uri',
      { status: 200 },
    );
  }
}
