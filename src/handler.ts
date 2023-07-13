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
  request: Request,
  allowedContentTypes: string[]
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

  if (allowedContentTypes.length > 0) {
    const contentType = response.headers.get("Content-Type");
    if (
      contentType &&
      !allowedContentTypes.some((a) => contentType.includes(a))
    ) {
      return new Response(`Forbidden Content Type: ${contentType}`, {
        status: 403,
        statusText: "Forbidden",
      });
    }
  }

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
  let endpointAllowlist: string[] = [];
  let contentTypeAllowlist: string[] = [];
  let pathAllowlist: string[] = [];
  let settingsString = "";
  if (env.ENDPOINT_ALLOWLIST) {
    endpointAllowlist = JSON.parse(env.ENDPOINT_ALLOWLIST);
    if (endpointAllowlist.length) {
      settingsString += `Allowed Endpoints:\n${endpointAllowlist.join(
        "\n"
      )}\n\n`;
    }
  }

  if (env.CONTENT_TYPE_ALLOWLIST) {
    contentTypeAllowlist = JSON.parse(env.CONTENT_TYPE_ALLOWLIST);
    if (contentTypeAllowlist.length) {
      settingsString += `Allowed Content Types:\n${contentTypeAllowlist.join(
        "\n"
      )}\n\n`;
    }
  }

  if (env.PATH_ALLOWLIST) {
    pathAllowlist = JSON.parse(env.PATH_ALLOWLIST);
    settingsString += `Allowed Paths:\n${pathAllowlist.join("\n")}\n\n`;
  }

  if (urlParam || pathUrl) {
    let endpointString = urlParam ? urlParam : pathUrl;
    endpointString =
      endpointString.indexOf("://") === -1
        ? `https://${endpointString}`
        : endpointString;

    const endpointUrl = new URL(endpointString);
    const path = endpointUrl.pathname;

    if (env.ENDPOINT_ALLOWLIST) {
      if (
        endpointAllowlist.length &&
        !endpointAllowlist.includes(endpointUrl.host)
      ) {
        return new Response(`Forbidden Endpoint: ${endpointUrl.host}`, {
          status: 403,
          statusText: `Forbidden`,
        });
      }
    }

    if (env.PATH_ALLOWLIST) {
      if (
        pathAllowlist.length &&
        !pathAllowlist.some((p) => new RegExp(p).test(path))
      ) {
        return new Response(`Forbidden path: ${path}`, {
          status: 403,
          statusText: `Forbidden`,
        });
      }
    }

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    } else if (allowedMethods.split(", ").includes(request.method)) {
      return handleAllowedMethods(endpointUrl, request, contentTypeAllowlist);
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
