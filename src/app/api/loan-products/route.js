const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ message: 'Sign in to load loan products.' }, { status: 401 });
  }
  if (!API_BASE_URL) {
    return Response.json({ message: 'NEXT_PUBLIC_API_URL is not configured.' }, { status: 500 });
  }

  const page = request.nextUrl.searchParams.get('page') || '0';
  const size = request.nextUrl.searchParams.get('size') || '10';
  const search = request.nextUrl.searchParams.get('search');
  const params = new URLSearchParams({ page, size });
  if (search) params.set('search', search);

  const headers = { Authorization: authorization, Accept: 'application/json' };
  const bankCode = request.headers.get('x-bank-code');
  if (bankCode) headers['X-Bank-Code'] = bankCode;

  try {
    const response = await fetch(`${API_BASE_URL}/api/loan-products?${params.toString()}`, {
      headers,
      cache: 'no-store',
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json(
        { message: result?.message || 'Unable to load loan products from the backend.' },
        { status: response.status },
      );
    }
    return Response.json(result);
  } catch {
    return Response.json({ message: 'Unable to load loan products from the backend.' }, { status: 502 });
  }
}