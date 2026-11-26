import { proxyLoanProductRequest } from './proxy';

export async function GET(request) {
  return proxyLoanProductRequest(request, 'GET');
}

export async function POST(request) {
  return proxyLoanProductRequest(request, 'POST');
}

export async function PUT(request) {
  return proxyLoanProductRequest(request, 'PUT');
}
