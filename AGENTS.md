# Architecture rules

- Select BLADE at the root entry using an exact /blade path boundary and dynamic imports; never import the LCSBARBER App, providers or stylesheet on that branch.
- BLADE accesses shared LCSBARBER data only through src/blade/data.ts; existing business tables remain read-only, while explicitly authorized slot requests use a dedicated server endpoint and table to avoid altering bookings.
- Keep slot-request activation off until the staged schema is accepted and deployment and email sender verification are authorized; stage server source outside auto-deployed functions to preserve draft isolation.
- Keep BLADE components and scoped CSS under src/blade with local assets under public/blade.
- Booking, payment, messaging and editing actions in BLADE stay disabled until explicitly requested, to avoid duplicating LCSBARBER business flows.
- Preserve the existing LCSBARBER entry behavior outside /blade.
- BLADE maps use Leaflet with OpenStreetMap tiles; keep the verified town-centre marker explicitly approximate until the exact business coordinates are supplied.
