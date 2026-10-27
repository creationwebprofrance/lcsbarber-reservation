# Community activation gates

Do not activate in this draft. Accepting the draft applies the additive schema; no existing business ownership is assigned here.

After explicit owner approval, from main:
1. Verify the provider integration, legacy-row provenance and existing booking compatibility. Only linked active providers and their own active services qualify.
2. Create `blade-work-private` with the Storage API as a private bucket, limit 50 MB. Do not add public object read policies.
3. Deploy the staged `blade-community` source and its local helpers. Configure a server-generated visitor HMAC secret and approved media-inspection endpoint/key. The inspector must fetch short-lived signed media URLs, decode image/video files and thumbnail, and return verified MIME, bytes, dimensions, duration and thumbnail_valid. Browser metadata cannot mark media ready. If no suitable inspection runtime is available, leave uploads inactive.
4. Verify MIME mismatch, oversized media, duration >60s, unreadable media, invalid thumbnails and cross-provider service association are rejected. Published media uses 120-second signed URLs; hiding immediately removes it from future reads, while an already-issued URL may remain usable until expiry.
5. Verify staged RLS with two authorized provider accounts and a third nonparticipant, direct API reads and realtime subscriptions. Do not provision a new provider through client metadata or hard-coded email ownership. The existing admin provider restriction remains until multi-provider onboarding is separately approved.
6. Check guest token issuance, signature tampering, idempotent authenticated/guest likes, request throttles and message retry uniqueness.
7. Only then set BLADE_COMMUNITY_ENABLED and the frontend COMMUNITY_ACTIVE switch.
8. Assistant activation additionally requires BLADE_ASSISTANT_ENABLED, existing server-held LOVABLE_API_KEY and BLADE_AI_REQUESTS_PER_DAY budget. Confirm the AI SDK runtime versions and execute actual initial and follow-up FR/EN/ES requests. Upstream 402/403/404 pauses persist; resume only after the cause is resolved by an owner action. Set frontend ASSISTANT_ACTIVE only after these checks.

## Deliberate pending capabilities
- Uploads, likes, private messages, profile saving and AI calls are not available in this draft because their schema/services are staged.
- The existing LCSBARBER booking route requires sign-in and has no provider/service URL preselection. Do not enable any public profile's booking_path until a compatible verified handoff exists. The user requested a guest booking journey, but changing identity/payment rules is outside the current compatibility-only handoff; do not claim this is delivered.
- Existing legacy BLADE screens still contain French business text; the new community screens, landing and preference controls have explicit FR/EN/ES dictionaries. Complete legacy-screen migration without DOM text replacement before claiming all-screen translation.
- Header/nav theme controls apply to existing screens; some legacy CSS literals remain and must be checked in connected business views before claiming full dark-theme coverage.
- No real publication, conversation, reaction, payment or email has been created for testing.