import { proxyLoanProductRequest } from '../proxy';

export async function PUT(request, context) {
  const { productId } = await context.params;
  return proxyLoanProductRequest(request, 'PUT', productId);
}
