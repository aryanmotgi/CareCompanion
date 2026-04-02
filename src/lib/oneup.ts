// Health Records Connection — supports Epic FHIR (direct) and 1upHealth (aggregator)
// When 1upHealth is approved, set ONEUPH_CLIENT_ID to switch to aggregator mode.
// Until then, uses Epic sandbox directly.

// === PROVIDER CONFIG ===

type Provider = 'epic' | '1uphealth';

function getActiveProvider(): Provider {
  // If 1upHealth credentials are set AND valid, use 1upHealth
  // Otherwise fall back to Epic direct
  const oneupId = process.env.ONEUPH_CLIENT_ID || '';
  const epicId = process.env.EPIC_CLIENT_ID || '';

  // For now, prefer Epic direct since 1upHealth needs approval
  if (epicId) return 'epic';
  if (oneupId) return '1uphealth';
  return 'epic';
}

const PROVIDER_CONFIG = {
  epic: {
    authorizeUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    scopes: 'launch/patient openid fhirUser patient/Patient.read patient/AllergyIntolerance.read patient/Condition.read patient/MedicationRequest.read patient/Observation.read patient/Appointment.read patient/Practitioner.read',
  },
  '1uphealth': {
    authorizeUrl: 'https://api.1up.health/connect/system/clinical',
    tokenUrl: 'https://api.1up.health/fhir/oauth2/token',
    fhirBaseUrl: 'https://api.1up.health/fhir/r4',
    scopes: '',
  },
};

function getCredentials(): { clientId: string; clientSecret: string } {
  const provider = getActiveProvider();
  if (provider === 'epic') {
    return {
      clientId: process.env.EPIC_CLIENT_ID || '',
      clientSecret: process.env.EPIC_CLIENT_SECRET || '',
    };
  }
  return {
    clientId: process.env.ONEUPH_CLIENT_ID || '',
    clientSecret: process.env.ONEUPH_CLIENT_SECRET || '',
  };
}

// === AUTH FUNCTIONS ===

/**
 * Build the authorization URL. Redirects user to the provider's login page.
 */
export function buildAuthUrl(userId: string): string {
  const provider = getActiveProvider();
  const config = PROVIDER_CONFIG[provider];
  const { clientId } = getCredentials();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/oneup/callback`;

  const state = Buffer.from(JSON.stringify({ userId, provider })).toString('base64url');

  if (provider === '1uphealth') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });
    return `${config.authorizeUrl}?${params.toString()}`;
  }

  // Epic SMART on FHIR
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes,
    state,
    aud: config.fhirBaseUrl,
  });

  return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  patient?: string; // Epic returns the FHIR patient ID
}> {
  const provider = getActiveProvider();
  const config = PROVIDER_CONFIG[provider];
  const { clientId, clientSecret } = getCredentials();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/oneup/callback`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
  });

  // Epic uses client_secret in body, 1upHealth also
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${provider}): ${res.status} — ${text}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token.
 */
export async function refreshToken(existingRefreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const provider = getActiveProvider();
  const config = PROVIDER_CONFIG[provider];
  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: existingRefreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${provider}): ${res.status}`);
  }

  return res.json();
}

// === FHIR DATA FUNCTIONS ===

/**
 * Fetch a FHIR resource from the connected provider.
 */
export async function fhirFetch(path: string, accessToken: string): Promise<Record<string, unknown>> {
  const provider = getActiveProvider();
  const config = PROVIDER_CONFIG[provider];
  const url = path.startsWith('http') ? path : `${config.fhirBaseUrl}/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  });

  if (!res.ok) {
    throw new Error(`FHIR fetch failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/**
 * Fetch all pages of a FHIR search result.
 */
export async function fhirSearchAll(resourceType: string, params: string, accessToken: string): Promise<Record<string, unknown>[]> {
  const resources: Record<string, unknown>[] = [];
  let url = `${resourceType}?${params}&_count=100`;

  while (url) {
    const bundle = await fhirFetch(url, accessToken) as {
      entry?: Array<{ resource: Record<string, unknown> }>;
      link?: Array<{ relation: string; url: string }>;
    };

    if (bundle.entry) {
      resources.push(...bundle.entry.map((e) => e.resource));
    }

    const nextLink = bundle.link?.find((l) => l.relation === 'next');
    url = nextLink?.url || '';
  }

  return resources;
}

/**
 * Get the current active provider name (for display).
 */
export function getProviderName(): string {
  const provider = getActiveProvider();
  return provider === 'epic' ? 'Epic MyChart' : '1upHealth';
}
