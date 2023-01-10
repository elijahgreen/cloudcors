const allowedMethods = "GET, HEAD, POST, OPTIONS";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": allowedMethods,
  "Access-Control-Allow-Headers":
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, user-agent",
  "Access-Control-Max-Age": "86400",
};

function handleOptions(request: Request): Response {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  if (
    request.headers.get("Origin") !== null &&
    request.headers.get("Access-Control-Request-Method") !== null &&
    request.headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS pre-flight request
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
  endpointUrl: URL,
  request: Request
): Promise<Response> {
  const originalUrl = new URL(request.url);
  request = new Request(endpointUrl.href, { ...request, redirect: "follow" });
  // Make server think that this request isn't cross-site
  request.headers.set("Origin", endpointUrl.origin);

  // Handle optional query params
  if (originalUrl.searchParams.has("setRequestHeaders")) {
    const setRequestHeaders = originalUrl.searchParams.get("setRequestHeaders");
    try {
      const requestHeaders = JSON.parse(setRequestHeaders || "{}");
      for (const [key, value] of Object.entries(requestHeaders)) {
        if (typeof value === "string") {
          request.headers.set(key, value);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  let response = await fetch(request);

  // Recreate the response so we can modify the headers
  response = new Response(response.body, response);

  response.headers.set("Access-Control-Allow-Origin", "*");

  // Append to/Add Vary header so browser will cache response correctly
  response.headers.append("Vary", "Origin");

  return response;
}

export async function handleRequest(
  request: Request,
  env: Bindings
): Promise<Response> {
  const originUrl = new URL(request.url);
  const urlParam = originUrl.searchParams.get("url");
  const pathUrl = request.url.replace(originUrl.origin, "").substring(1);
  let allowlist: string[] = [];
  let settingsString = "";
  if (env.ENDPOINT_ALLOWLIST) {
    allowlist = JSON.parse(env.ENDPOINT_ALLOWLIST);
    if (allowlist.length) {
      settingsString += `Allowlist:\n${allowlist.join("\n")}`;
    }
  }

  if (urlParam || pathUrl) {
    let endpointString = urlParam ? urlParam : pathUrl;
    endpointString =
      endpointString.indexOf("://") === -1
        ? `https://${endpointString}`
        : endpointString;

    const endpointUrl = new URL(endpointString);

    if (env.ENDPOINT_ALLOWLIST) {
      if (allowlist.length && !allowlist.includes(endpointUrl.host)) {
        return new Response(null, {
          status: 403,
          statusText: "Forbidden",
        });
      }
    }
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    } else if (allowedMethods.split(", ").includes(request.method)) {
      return handleAllowedMethods(endpointUrl, request);
    } else {
      return new Response(null, {
        status: 405,
        statusText: "Method Not Allowed",
      });
    }
  } else {
    return new Response(
      "CLOUDCORS\n\n" +
        "Usage:\n" +
        originUrl.origin +
        "?url=uri\nor\n" +
        originUrl.origin +
        "/uri\n\n" +
        settingsString,
      { status: 200 }
    );
  }
}
