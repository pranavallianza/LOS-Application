export async function POST(request) {
  const branch = await request.json().catch(() => null);

  if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
    return Response.json({ success: false, message: 'A branch payload is required.' }, { status: 400 });
  }

  console.log('[dummy bank branch route] received payload:', branch);

  return Response.json({
    success: true,
    message: 'Bank branch created successfully.',
    data: { ...branch, id: `BRANCH-${Date.now()}` },
  }, { status: 201 });
}