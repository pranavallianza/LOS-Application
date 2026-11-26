function isAllowedPath(method, path) {
  const [resource, , action] = path;

  if (method === 'GET') {
    return (resource === 'leads' && (path.length === 1 || path.length === 2))
      || (resource === 'lookups' && path.length === 1);
  }
  if (method === 'POST') {
    return resource === 'leads' && path.length === 1;
  }
  if (method === 'PUT') {
    return resource === 'leads'
      && (path.length === 2 || (path.length === 3 && action === 'assign'));
  }
  return false;
}

function getUpstreamUrl(request, path) {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_LOAN_PRODUCTS_API_URL;
  const apiBaseUrl = configuredUrl?.trim()
    .replace(/\/+$/, '')
    .replace(/\/api(?:\/v\d+)?$/i, '');

  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }

  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  const url = new URL(`${apiBaseUrl}/api/${encodedPath}`);
  url.search = new URL(request.url).search;
  return url;
}

async function proxyLeadRequest(request, context, method) {
  const { path } = await context.params;
  if (!isAllowedPath(method, path)) {
    return Response.json({ message: 'This lead API route is not supported.' }, { status: 404 });
  }

  let upstreamUrl;
  try {
    upstreamUrl = getUpstreamUrl(request, path);
  } catch (error) {
    return Response.json({ message: error.message }, { status: 500 });
  }

  const headers = new Headers({ Accept: request.headers.get('accept') || 'application/json' });
  for (const name of ['authorization', 'content-type', 'x-bank-code']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const options = { method, headers, cache: 'no-store' };
  if (method === 'POST' || method === 'PUT') {
    options.body = await request.text();
  }

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, options);
  } catch {
    return Response.json(
      { message: 'Unable to connect to the lead service.' },
      { status: 502 },
    );
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status });
  }

  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('Content-Type', contentType);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxyLeadRequest(request, context, 'GET');
}

export async function POST(request, context) {
  return proxyLeadRequest(request, context, 'POST');
}

export async function PUT(request, context) {
  return proxyLeadRequest(request, context, 'PUT');
}
