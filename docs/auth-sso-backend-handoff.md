# Auth SSO Backend Handoff

This project is ready to integrate backend-managed SSO for Google, Azure, Apple, and SAML 2.0.

## Frontend contract already implemented

- OAuth buttons call Supabase directly:
  - `google`
  - `azure`
  - `apple`
- SAML button calls Supabase SSO with a resolved domain.
- If `VITE_AUTH_SAML_DISCOVERY_ENDPOINT` is configured, frontend resolves domain via backend first.

## Required backend endpoint (optional but recommended)

If your org maps users to SSO domains dynamically, expose:

- `POST /auth/sso/discovery`
- Request body:

```json
{ "email": "user@company.com" }
```

- Response body:

```json
{ "domain": "company.com" }
```

Error responses should use non-2xx status codes. Frontend displays a generic SSO resolution error.

## Supabase provider setup responsibilities (backend/platform)

- Enable providers in Supabase Auth:
  - Google OAuth
  - Azure OAuth
  - Apple OAuth
  - SAML 2.0
- Configure redirect URLs to the app origin.
- For SAML, map corporate domains so `signInWithSSO({ domain })` resolves correctly.

## Frontend env toggles

Use `.env` or deployment variables:

- `VITE_AUTH_GOOGLE_ENABLED=true|false`
- `VITE_AUTH_AZURE_ENABLED=true|false`
- `VITE_AUTH_APPLE_ENABLED=true|false`
- `VITE_AUTH_SAML_ENABLED=true|false`
- `VITE_AUTH_SAML_DISCOVERY_ENDPOINT=<url>` (optional)

These toggles only affect visible login options, so backend can roll out provider-by-provider safely.
