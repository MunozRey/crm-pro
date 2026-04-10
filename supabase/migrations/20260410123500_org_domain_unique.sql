-- Enforce unique organization slug/domain (case-insensitive)
-- Prevents two organizations from sharing the same public slug.

CREATE UNIQUE INDEX IF NOT EXISTS organizations_domain_unique_idx
ON public.organizations (lower(domain))
WHERE domain IS NOT NULL;
