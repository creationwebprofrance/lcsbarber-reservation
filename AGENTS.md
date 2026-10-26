# Architecture rules

- Select BLADE at the root entry using an exact /blade path boundary and dynamic imports; never import the LCSBARBER App, providers or stylesheet on that branch.
- BLADE accesses shared LCSBARBER data through src/blade/data.ts; provider business reads and explicit saves use owner-validated RPCs, while vehicles retain existing owner-scoped tables, to avoid client-side authorization assumptions.
- Keep slot-request activation off until the staged schema is accepted and deployment and email sender verification are authorized; stage server source outside auto-deployed functions to preserve draft isolation.
- Keep BLADE components and scoped CSS under src/blade with local assets under public/blade.
- Keep booking/payment flows separate; provider editing is explicitly authorized, but staged schema and manual email activation require acceptance and deployment approval to preserve shared-backend isolation.
- Preserve the existing LCSBARBER entry behavior outside /blade.
- BLADE maps use Leaflet with OpenStreetMap tiles; keep the verified town-centre marker explicitly approximate until the exact business coordinates are supplied.
- Professional provider screens use provider.tsx and provider-model.ts with existing maintenance calculations without generic forecast defaults; this keeps accounting and maintenance rules testable without invented records.
- Legacy rows without verified ownership are not included in provider RPCs; assign approved IDs transactionally with compatible service/booking/client links only after backup and provenance approval, because shared access is not proof of ownership.
