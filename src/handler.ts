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

const redirectStatuses = [301, 302, 303, 307, 308];
const maxRedirects = 10;

async function handleAllowedMethods(
  endpointUrl: URL,
  request: Request,
  allowlists: Allowlists
): Promise<Response> {
  const originalUrl = new URL(request.url);
  // Redirects are followed by hand so every hop is held to the allowlists;
  // with "follow" an allowed host could send the proxy anywhere.
  request = new Request(endpointUrl.href, { ...request, redirect: "manual" });

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

  // A worker subrequest carries no User-Agent, and some sites (4chan's API)
  // answer that with 429. Not the caller's: a browser-like one sets off bot
  // checks such as lobste.rs's.
  if (!request.headers.has("User-Agent")) {
    request.headers.set("User-Agent", "cloudcors");
  }

  let response = await fetch(request);
  for (let hop = 0; redirectStatuses.includes(response.status); hop++) {
    const location = response.headers.get("Location");
    if (!location) {
      break;
    }
    if (hop === maxRedirects) {
      return new Response("Too many redirects", {
        status: 508,
        statusText: "Loop Detected",
      });
    }
    const nextUrl = new URL(location, request.url);
    const reason = getForbiddenReason(nextUrl, allowlists);
    if (reason) {
      return new Response(`Redirect blocked. ${reason}`, {
        status: 403,
        statusText: "Forbidden",
      });
    }
    request = new Request(nextUrl.href, request);
    response = await fetch(request);
  }

  // Recreate the response so we can modify the headers
  response = new Response(response.body, response);

  const allowedContentTypes = allowlists.contentTypes;
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

function isEndpointAllowed(endpoints: string[], url: URL): boolean {
  return endpoints.includes(url.host);
}

function isPathAllowed(paths: string[], path: string): boolean {
  return paths.some((p) => new RegExp(p).test(path));
}

interface Allowlists {
  endpoints: string[];
  contentTypes: string[];
  paths: string[];
}

/**
 * Why `endpointUrl` may not be fetched, or undefined when it may. Applied to
 * the requested url and to every redirect it leads to.
 */
function getForbiddenReason(
  endpointUrl: URL,
  allowlists: Allowlists
): string | undefined {
  if (endpointUrl.protocol !== "http:" && endpointUrl.protocol !== "https:") {
    return `Forbidden protocol: ${endpointUrl.protocol}`;
  }
  const path = endpointUrl.pathname;
  if (allowlists.endpoints.length) {
    if (
      !isEndpointAllowed(allowlists.endpoints, endpointUrl) &&
      !isPathAllowed(allowlists.paths, path)
    ) {
      return `Forbidden Endpoint: ${endpointUrl.host}`;
    }
  } else if (allowlists.paths.length && !isPathAllowed(allowlists.paths, path)) {
    return `Forbidden path: ${path}`;
  }
  return undefined;
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
    if (pathAllowlist.length) {
      settingsString += `Allowed Paths:\n${pathAllowlist.join("\n")}\n\n`;
    }
  }

  if (urlParam || pathUrl) {
    let endpointString = urlParam ? urlParam : pathUrl;
    endpointString =
      endpointString.indexOf("://") === -1
        ? `https://${endpointString}`
        : endpointString;

    let endpointUrl: URL;
    try {
      endpointUrl = new URL(endpointString);
    } catch {
      return new Response("Invalid url", {
        status: 400,
        statusText: "Bad Request",
      });
    }
    const allowlists: Allowlists = {
      endpoints: endpointAllowlist,
      contentTypes: contentTypeAllowlist,
      paths: pathAllowlist,
    };
    const reason = getForbiddenReason(endpointUrl, allowlists);
    if (reason) {
      return new Response(reason, {
        status: 403,
        statusText: `Forbidden`,
      });
    }

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    } else if (allowedMethods.split(", ").includes(request.method)) {
      return handleAllowedMethods(endpointUrl, request, allowlists);
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
