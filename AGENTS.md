# Architecture rules

- Select BLADE at the root entry using an exact /blade path boundary and dynamic imports; never import the LCSBARBER App, providers or stylesheet on that branch.
- BLADE reads the shared LCSBARBER database only through src/blade/data.ts (shared client, same accounts) and never inserts, updates or deletes, so LCSBARBER stays the single source of truth.
- Keep BLADE components and scoped CSS under src/blade with local assets under public/blade.
- Booking, payment, messaging and editing actions in BLADE stay disabled until explicitly requested, to avoid duplicating LCSBARBER business flows.
- Preserve the existing LCSBARBER entry behavior outside /blade.
