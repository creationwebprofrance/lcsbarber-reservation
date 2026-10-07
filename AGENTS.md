# Architecture rules

- Select BLADE at the root entry using an exact /blade path boundary and dynamic imports; never import the LCSBARBER application or stylesheet on that branch, so its providers and service side effects cannot run.
- Keep BLADE components and scoped semantic CSS under src/blade with local assets under public/blade; BLADE imports only React, router, icons and service-free UI primitives to guarantee network isolation.
- BLADE forms and navigation state are transient React state only; service-dependent actions stay disabled to avoid simulating business operations or creating data.
- Preserve the existing LCSBARBER entry behavior outside /blade; do not change its services, production configuration or database from the BLADE draft.