function isAllowedPath(method, path) {
  const [resource, , action] = path;

  if (method === "GET") {
    return ["lookups", "sub-lookups"].includes(resource) && path.length <= 3;
  }
  if (method === "POST") {
    return (resource === "lookups" && path.length === 1)
      || (resource === "lookups" && path.length === 3 && action === "sub-lookups");
  }
  if (method === "PUT") {
    return (resource === "lookups" && path.length === 2)
      || (resource === "sub-lookups" && path.length === 2);
  }
  if (method === "PATCH") {
    return ["lookups", "sub-lookups"].includes(resource)
      && path.length === 3
      && action === "status";
  }
  return false;
}

function getUpstreamUrl(request, path) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_LOAN_PRODUCTS_API_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    throw new Error("NEXT_PUBLIC_LOAN_PRODUCTS_API_URL is not configured.");
  }

  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(`${apiBaseUrl}/api/${encodedPath}`);
  url.search = new URL(request.url).search;
  return url;
}

async function proxyLookupRequest(request, context, method) {
  const { path } = await context.params;
  if (!isAllowedPath(method, path)) {
    return Response.json({ message: "This lookup API route is not supported." }, { status: 404 });
  }

  let upstreamUrl;
  try {
    upstreamUrl = getUpstreamUrl(request, path);
  } catch (error) {
    return Response.json({ message: error.message }, { status: 500 });
  }

  const headers = new Headers({ Accept: request.headers.get("accept") || "application/json" });
  for (const name of ["authorization", "content-type", "x-bank-code"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const options = { method, headers, cache: "no-store" };
  if (["POST", "PUT", "PATCH"].includes(method)) {
    options.body = await request.text();
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, options);
  } catch {
    return Response.json({ message: "Unable to connect to the lookup service." }, { status: 502 });
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status });
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("Content-Type", contentType);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxyLookupRequest(request, context, "GET");
}

export async function POST(request, context) {
  return proxyLookupRequest(request, context, "POST");
}

export async function PUT(request, context) {
  return proxyLookupRequest(request, context, "PUT");
}

export async function PATCH(request, context) {
  return proxyLookupRequest(request, context, "PATCH");
}
