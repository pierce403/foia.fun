# Vercel freeze procedure and window evidence

The first approved window on 2026-10-12 was safely aborted before final copying.
Maintenance and the project-wide method rule were activated, but protected
immutable aliases returned401 before project WAF. Authenticated denial remained
unverified. At16:31:35UTC the exact original Vercel deployment was restored,
public reads200 and invalid empty POST400 passed, and the sole temporary rule was
removed. WAF is now enabled, version2, with no custom rules. Source counts remain
one idea, two comments and two votes; Cloudflare production D1 is empty/read-only.
No final export/import or bypass credential creation occurred.

The coordinator subsequently repaired www through the existing Cloudflare
redirect middleware. HTTPS www preserves path/query with308 to the original
Vercel apex; apex remains DNS-only and writable. Historical NXDOMAIN evidence
must not be used as a current www gate.

A scoped temporary-authentication probe is prepared and offline-tested in the
private coordination recovery folder, pending owner approval and a new window.
It must prove authenticated GET200 followed by method403 on every old host,
revoke its exact temporary credential, and confirm the empty credential baseline.
No credential creation is implied by this document. Private command/review notes:
`foia-authenticated-probe-review.md` and `foia-cutover-review.md`.

The initial configuration read, before the first attempt, returned active:null,
draft:null and versions:[]. Those initial observations and bodies are preserved
in `work/vercel-migration/foia-recovery/`; they are historical now.

The coordinator must re-read configuration immediately before a later cutover.
Match the complete active state to saved `window-abort-waf-empty-confirmation.json`
(enabled, version2, no custom rules), require no draft, and revise the private
activation helper for that exact reviewed baseline. The original null-only helper
intentionally refuses reactivation. Preserve any intervening changes. The prepared PUT is an activation operation, not a dry
run. Its endpoint is `/v1/security/firewall/config` with `projectId` and `teamId`
query parameters. Use the stored private `vercel-waf-freeze-put.json` body:

- `firewallEnabled: true`.
- Exactly one active rule, action `mitigate.action: deny`.
- One condition group: `method inc [POST, PUT, PATCH, DELETE]` across the
  entire project. Do not add a path condition: encoded or rewritten API paths
  must encounter the same freeze.
- No hostname, environment, IP, cookie or header restrictions. This applies to
  project traffic, including current production and older preview/deployment
  aliases; do not narrow the rule to the custom domain.
- No rate limiting, paid managed rulesets, new plan or billing feature. Vercel
  documents custom rules as free on every plan.

The minimal maintenance branch `codex/vercel-maintenance` is based on current
Vercel source 27cfd6f. Deploy it explicitly with runtime `FOIA_READ_ONLY=true`
only when the coordinator starts the window. Its notice remains readable and
all three mutation handlers return 503 before storage/cookie work. GET paths
and Blob behavior are unchanged. This alone does not protect immutable older
Vercel URLs; the WAF rule is the comprehensive source-write boundary.

At activation, record the returned active version and verify the active read
has exactly this enabled rule before the final data copy. Send harmless empty
JSON to all three mutation routes on the apex, www, production alias,
production immutable URL, and every discovered preview/branch/immutable alias.
Include encoded path spellings and a non-API path with the same harmless body.
Require a Vercel WAF denial (normally 403). Vercel evaluates its platform-wide
firewall first, deployment protection second, and project WAF rules third.
Protected aliases therefore return 401 before the custom rule is evaluated.
That proves deployment protection only; it does not replace authenticated
verification of the old deployment's method denial. Do not create a new bypass
credential without explicit authorization. Keep the final copy stopped until
the coordinator reviews supported authenticated evidence.
Repeated-slash URLs can return a same-host 308 before these layers. Follow only
the verified relative canonical destination with the same method and harmless
body, and require the destination's denial; do not accept arbitrary redirects.
A 400 from application validation proves the freeze is missing.
Also verify GET homepage/ideas/comments still succeeds on public aliases.
Do not use valid synthetic post/vote bodies on the source.

The current project metadata and production deployment both report fluid compute
with a 300-second function timeout. After confirming the freeze everywhere, allow
at least 300 seconds for in-flight requests to drain. Then take two uncached
source exports separated by 300 seconds; require identical record sets and counts
before final import. Re-check timeout metadata at cutover and use a longer bound
if any still-reachable deployment has a larger configured timeout. Refresh aliases/deployment inventory
and freeze verification before declaring the source quiescent. Abort cutover if
any reachable alias can mutate or source snapshots change.

Keep the Vercel freeze after Cloudflare opens writes. For rollback after any D1
write, first freeze Cloudflare, export D1, reverse-copy only missing records to
Blob with the reviewed tool, and reconcile exact records. Restore the prior
Vercel deployment/notice state and withdraw only this custom rule after storage
has reconciled. If configuration still contains only our rule, the prepared
`vercel-waf-remove-freeze-put.json` removes it, leaving the firewall enabled with
no custom rules. It does not recreate the original null configuration metadata.
If unrelated rules appeared, remove only our returned rule ID through a draft
change and reviewed activation. Never overwrite intervening configuration.

Sources checked 2026-10-12:
- https://vercel.com/docs/rest-api/security/returns-activated-waf-config
- https://vercel.com/docs/rest-api/security/put-firewall-configuration
- https://raw.githubusercontent.com/vercel/sdk/main/src/models/putfirewallconfigop.ts
- https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration
- https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing
- https://vercel.com/docs/vercel-firewall/firewall-concepts

## Safe baseline before activation

Eight known project hosts were probed with POST `{}` against the ideas, votes,
and invalid-UUID comments endpoints. These bodies cannot pass source validation.
The apex and `foiafun.vercel.app` each returned400 for all three. Five private
branch/immutable aliases each returned401 deployment protection. `www.foia.fun`
failed DNS lookup on this network. No valid mutation bodies were sent. The
private report is `foia-recovery/vercel-alias-write-baseline.json`. This is a
baseline, not evidence of an active freeze; check DNS and re-run after activation.
