export async function proxyLoanProductRequest(request, method, productId) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    const message = method === 'GET'
      ? 'Sign in to load loan products.'
      : 'Sign in to save loan products.';
    return Response.json({ message }, { status: 401 });
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_LOAN_PRODUCTS_API_URL;
  const apiBaseUrl = configuredUrl?.trim()
    .replace(/\/+$/, '')
    .replace(/\/api(?:\/v\d+)?$/i, '');
  if (!apiBaseUrl) {
    return Response.json({ message: 'NEXT_PUBLIC_API_URL is not configured.' }, { status: 500 });
  }

  const productPath = productId ? `/${encodeURIComponent(productId)}` : '';
  const url = new URL(`${apiBaseUrl}/api/loan-products${productPath}`);
  if (method === 'GET') url.search = new URL(request.url).search;

  const headers = new Headers({
    Authorization: authorization,
    Accept: request.headers.get('accept') || 'application/json',
  });
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const options = { method, headers, cache: 'no-store' };
  if (method !== 'GET') options.body = await request.text();

  let upstream;
  try {
    upstream = await fetch(url, options);
  } catch {
    return Response.json(
      { message: 'Unable to connect to the loan products service.' },
      { status: 502 },
    );
  }

  if (upstream.status === 204 || upstream.status === 304) {
    return new Response(null, { status: upstream.status });
  }

  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('Content-Type', upstreamContentType);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
