# Architecture rules

- Select BLADE at the root entry using an exact /blade path boundary and dynamic imports; never import the LCSBARBER App, providers or stylesheet on that branch.
- BLADE accesses shared LCSBARBER data through src/blade/data.ts; provider business reads and explicit saves use owner-validated RPCs, while vehicles retain existing owner-scoped tables, to avoid client-side authorization assumptions.
- BLADE slot requests are live through the create-slot-request server function; drafts must still stage new server source outside auto-deployed functions to preserve draft isolation.
- Keep BLADE components and scoped CSS under src/blade with local assets under public/blade.
- Keep booking/payment flows separate; provider editing is explicitly authorized, but staged schema and manual email activation require acceptance and deployment approval to preserve shared-backend isolation.
- Preserve the existing LCSBARBER entry behavior outside /blade.
- BLADE maps use Leaflet with OpenStreetMap tiles; keep the verified town-centre marker explicitly approximate until the exact business coordinates are supplied.
- Professional provider screens use provider.tsx and provider-model.ts with existing maintenance calculations without generic forecast defaults; this keeps accounting and maintenance rules testable without invented records.
- All pre-BLADE LCSBARBER rows were assigned to the LCS Barber provider with a row-level backup in blade_legacy_assignment_backup, and an insert trigger gives LCSBARBER-created rows that owner, because the LCSBARBER site never sets provider_id itself.
- BLADE pro access depends on blade_providers.status='active' (pending/suspended accounts see a status screen); superadmin rights come only from user_roles 'superadmin' and per-provider options are changed only through superadmin RPCs, so providers can never grant themselves options.
- BLADE automatic emails go through blade-notify (user actions) and the once-daily blade-daily job (reminders, 30-day inactivity), sharing supabase/functions/_shared/blade-email.ts; each event re-checks ownership and the provider's email option server-side.
- BLADE deposit links are provider-supplied Revolut/Stripe payment links that cannot be verified automatically, so link-paid bookings stay pending until the provider marks the deposit received; this keeps the LCSBARBER Stripe Checkout flow separate.
- BLADE community uses separate provider-owned publications, server-issued visitor reactions and participant-only private conversations; keep activation off until additive schema, private media storage and server processing are verified, so the draft never simulates successful persistence.
- BLADE language/theme preferences and dictionaries are local to its entry; public provider profile routes sit outside private account guards, preserving public discovery without mixing account spaces.
