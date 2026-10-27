# October 27 community additions

## Verified
- Landing and original hero/video/map retained; gallery below map, collaboration, travel reminder and footer added.
- No provider photos, names, prices, messages or likes invented. Gallery explains that publications are not yet accessible in this preview.
- Original PDF robot extracted, transparency mask restored; local asset fallback renders in the sandbox after the asset-pointer URL did not render there.
- Playwright 390/768/1440: no horizontal overflow or page errors. Spanish and dark preference persist after reload. French landing and assistant FAQ work.
- Public search input Louvres navigates to `/blade/client?mode=Chez+vous&q=Louvres`; current search controls do not yet apply the URL query to live provider results.
- Screenshot review caught low-contrast dark buttons and a broken robot image; contrast overrides and a local robot fallback fixed the inspected landing.
- 22 tests / 69 assertions passed across community/model/provider/request rules. Latest preview build signal: build OK.

## Not verified / not active
New schema is staged only, therefore no fake publication/upload, guest reaction, private conversation or AI response was exercised. No real messages, email, payments or bulk ownership updates were made.

Publication editor, immersive reader, private messages and grounded assistant server source are prepared but gated until acceptance, provider attachment, private Storage creation, approved processing and server activation. Server source is outside auto-deployed functions.

Public profiles do not yet provide reviews/availability across multiple providers. Existing BLADE availability is still its old shared-calendar read, not a new per-provider reservation engine. Legacy business pages are not fully translated, and guest reservation/preselection is not implemented. These are remaining work, not verified features.

No changes published or merged; LCSBARBER application files unchanged.