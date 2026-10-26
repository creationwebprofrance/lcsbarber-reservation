# Provider integration delivery

## Read-only baseline, October 26, 2026
- Verified Auth UUID/profile/admin role: da0b2f45-1ee1-441e-a06d-3bd046615ca8.
- Same Supabase project for both entry points. Services 5; pricing rules 9; clients 80; bookings 189; merges 32; manual work 0; templates 3; Lucas-owned vehicles 2.
- Bookings: completed 2 / €45; confirmed 182 / €4,950; pending 5 / €185. Confirmed/completed baseline €4,995. These are contract totals, not receipts.
- No provider ownership columns exist on legacy business tables. Existing roles confer global admin access; vehicle policies already scope owner_id.

## Unattributed records
All 5 services, 9 rules, 80 clients, 189 bookings, 32 merges and 3 templates remain unattributed: the account identity does not establish provenance. No bulk data operation or real email was performed. Vehicles retain their existing owner_id.

## Changes
- Six-tab navigation and provider pages; legacy agenda stays reachable without becoming a seventh tab.
- data.ts provides provider-scoped bundle/save RPC access and existing owner-scoped vehicle reads/writes.
- provider-model.ts and tests cover revenue, duplicate exclusion, city eligibility, pricing validation and existing maintenance calculation.
- Staged provider migration adds ownership, client/booking links and normalized city without assigning legacy rows. Existing admin is a legacy custodian, not inferred owner. Restricted provider writes validate links.
- Staged manual email sender validates Auth/admin/provider/client/template/booking and uses existing Resend infrastructure. Disabled until deployment and verified sender are separately authorized. Existing transactional functions are not deployed or edited.
- Main-compatible fixes: explicit service price saves without mass emails; monthly chart and annual total share confirmed/completed status filter; city alias correction does not overwrite addresses.

## Activation and backup gates
Before any ownership reassignment, capture a private database/schema backup using the project's authorized database export facility, compare the baseline counts/totals and obtain approval for the exact IDs and provenance. No backup of private client details has been exported from this draft. All unattributed rows require that approval; do not seed provider_id across the database.
Accepting applies additive schema only. Provider pages intentionally show a real unavailable state until acceptance; after acceptance they will only show verified assigned records. Do not add live-schema or fixture fallbacks.
Rollback before activation: leave new nullable ownership columns unassigned and retain existing tables/IDs. After assignment: restore affected values from the approved backup, preserving subsequent real bookings. Never drop tables or globally reset records.

## Verification limitations
External unmanaged Supabase prevents authenticated browser checks here. New schema is not live in this draft. Persistent provider saves, cross-account direct access and real email delivery remain unverified until acceptance, provenance approval and service activation. Existing service-role transactional writers require a dedicated compatibility/ownership pass before onboarding another provider; this delivery does not claim multi-provider production readiness.