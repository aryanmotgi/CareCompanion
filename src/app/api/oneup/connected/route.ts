/**
 * Post-system-search callback for 1upHealth.
 *
 * After the user selects and authorizes their hospital in the 1upHealth
 * system-search widget, 1upHealth redirects to this endpoint.
 *
 * 1upHealth may append params like ?system_id=... or ?status=... —
 * we ignore them since the FHIR data is now available on their server
 * and our connect page auto-syncs when it detects a recent connection.
 *
 * This is registered as the redirect_uri passed to system-search.1up.health.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://carecompanionai.org';
  // Log any params 1upHealth sends back for debugging
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  console.log('[oneup/connected] hospital connected, redirecting to app:', params);
  return NextResponse.redirect(`${baseUrl}/connect?connected=1uphealth`);
}
