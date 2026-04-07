// SMART on FHIR provider registry
// Each provider has OAuth endpoints and FHIR base URL
// Users can connect to any of these directly (no middleman like 1upHealth needed)

export interface FhirProvider {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji for now
  authorizeUrl: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  scopes: string;
  // Some providers need special handling
  supportsRefresh: boolean;
  // Whether this provider uses PKCE (Proof Key for Code Exchange)
  requiresPkce: boolean;
  // Registration status
  status: 'sandbox' | 'production' | 'coming_soon';
  // Environment variable names for credentials
  envClientId: string;
  envClientSecret: string;
}

// Epic sandbox uses non-production endpoints for testing
// Once approved, swap to production URLs
export const FHIR_PROVIDERS: FhirProvider[] = [
  {
    id: 'epic',
    name: 'Epic MyChart',
    description: 'Used by ~60% of US hospitals including Mayo Clinic, Johns Hopkins, Cleveland Clinic',
    icon: '🏥',
    authorizeUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    scopes: 'launch/patient openid fhirUser patient/Patient.read patient/AllergyIntolerance.read patient/Condition.read patient/MedicationRequest.read patient/Observation.read patient/Appointment.read patient/Practitioner.read patient/ExplanationOfBenefit.read patient/Coverage.read',
    supportsRefresh: true,
    requiresPkce: false,
    status: 'sandbox',
    envClientId: 'EPIC_CLIENT_ID',
    envClientSecret: 'EPIC_CLIENT_SECRET',
  },
  {
    id: 'cerner',
    name: 'Oracle Health (Cerner)',
    description: 'Used by ~25% of US hospitals including VA hospitals, community health centers',
    icon: '🏨',
    authorizeUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenUrl: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
    fhirBaseUrl: 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    scopes: 'launch/patient openid fhirUser patient/Patient.read patient/AllergyIntolerance.read patient/Condition.read patient/MedicationRequest.read patient/Observation.read patient/Appointment.read',
    supportsRefresh: true,
    requiresPkce: false,
    status: 'sandbox',
    envClientId: 'CERNER_CLIENT_ID',
    envClientSecret: 'CERNER_CLIENT_SECRET',
  },
  {
    id: 'medicare',
    name: 'Medicare Blue Button',
    description: 'Access your Medicare claims, coverage, and benefits data from CMS',
    icon: '🇺🇸',
    authorizeUrl: 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/',
    tokenUrl: 'https://sandbox.bluebutton.cms.gov/v2/o/token/',
    fhirBaseUrl: 'https://sandbox.bluebutton.cms.gov/v2/fhir',
    scopes: 'patient/Patient.read patient/ExplanationOfBenefit.read patient/Coverage.read',
    supportsRefresh: true,
    requiresPkce: false,
    status: 'sandbox',
    envClientId: 'MEDICARE_CLIENT_ID',
    envClientSecret: 'MEDICARE_CLIENT_SECRET',
  },
  {
    id: 'google_health',
    name: 'Google Health Connect',
    description: 'Sync fitness, activity, and vitals data from Google Fit and connected devices',
    icon: '💚',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    fhirBaseUrl: '', // Google Health Connect uses REST API, not FHIR
    scopes: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.blood_pressure.read https://www.googleapis.com/auth/fitness.sleep.read',
    supportsRefresh: true,
    requiresPkce: false,
    status: 'coming_soon',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  {
    id: '1uphealth',
    name: '1upHealth',
    description: 'Connect to 700+ health systems at once. Aggregates records from Epic, Cerner, Medicare, and more.',
    icon: '🔗',
    authorizeUrl: 'https://api.1up.health/connect/marketplace',
    tokenUrl: 'https://api.1up.health/oauth2/token',
    fhirBaseUrl: 'https://api.1up.health/r4',
    scopes: '',
    supportsRefresh: true,
    requiresPkce: false,
    status: 'sandbox',
    envClientId: 'ONEUP_CLIENT_ID',
    envClientSecret: 'ONEUP_CLIENT_SECRET',
  },
  {
    id: 'va',
    name: 'VA Health',
    description: 'Access your Veterans Affairs health records through the VA Lighthouse API',
    icon: '⭐',
    authorizeUrl: 'https://sandbox-api.va.gov/oauth2/health/v1/authorization',
    tokenUrl: 'https://sandbox-api.va.gov/oauth2/health/v1/token',
    fhirBaseUrl: 'https://sandbox-api.va.gov/services/fhir/v0/r4',
    scopes: 'launch/patient openid profile patient/Patient.read patient/AllergyIntolerance.read patient/Condition.read patient/MedicationRequest.read patient/Observation.read patient/Appointment.read',
    supportsRefresh: true,
    requiresPkce: true,
    status: 'coming_soon',
    envClientId: 'VA_CLIENT_ID',
    envClientSecret: 'VA_CLIENT_SECRET',
  },
];

export function getProvider(id: string): FhirProvider | undefined {
  return FHIR_PROVIDERS.find((p) => p.id === id);
}

export function getAvailableProviders(): FhirProvider[] {
  // Return providers that have credentials configured or are in sandbox mode
  return FHIR_PROVIDERS.filter((p) => {
    if (p.status === 'coming_soon') return true; // Show but disabled
    const clientId = process.env[p.envClientId];
    return !!clientId || p.status === 'sandbox';
  });
}

export function isProviderConfigured(id: string): boolean {
  const provider = getProvider(id);
  if (!provider) return false;
  return !!process.env[provider.envClientId];
}
