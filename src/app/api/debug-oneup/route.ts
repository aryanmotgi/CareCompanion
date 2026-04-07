export async function GET() {
  const clientId = process.env.ONEUP_CLIENT_ID || '';
  const hasSecret = !!process.env.ONEUP_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET';

  return Response.json({
    clientId_set: !!clientId,
    clientId_prefix: clientId ? clientId.substring(0, 6) + '...' : 'empty',
    secret_set: hasSecret,
    app_url: appUrl,
    redirect_uri: `${appUrl}/api/fhir/callback`,
  });
}
