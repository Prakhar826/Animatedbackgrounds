# ZeroGPU Edge preparation (not production-enabled)

This folder is an isolated preparation prototype. It is **not linked from the website**, is not included in the static-site build, and does not load or initialize the ZeroGPU SDK. The main branch and live site remain unchanged.

## What the current public SDK docs show

The current public npm package is `@zerogpu/browser-extension-sdk` (version 0.4.0 at the time this prototype was prepared). Despite the package name, its README describes a browser SDK and provides a CDN UMD loader for ordinary web pages:

```html
<script async src="https://js-sdk.zerogpu.ai/dist/loader.js"></script>
<script>
  ZeroGpuSdk.initZeroGpuSdk({
    edgeOperatorKey: "YOUR_APPROVED_EDGE_OPERATOR_KEY"
  });
</script>
```

The README explains that the loader injects the current versioned UMD bundle. It also says the extension path is different because Chrome Manifest V3 prohibits remotely hosted code; that restriction does not apply in the same way to a regular website page.

The documented browser runtime downloads a small language model, collects device-capability information, registers the device with the ZeroGPU orchestrator, opens a WebSocket, and processes assigned on-device summarization work. The README documents initialization and custom reporting parameters, but the public README material reviewed for this prototype does **not** document a clear in-page stop/disconnect API.

References:
- Package and browser loader: https://www.npmjs.com/package/@zerogpu/browser-extension-sdk
- SDK source repository: https://github.com/zerogpu/zerogpu-browser-sdk
- ZeroGPU monetization terms: https://zerogpu.ai/developer-terms
- ZeroGPU Edge: https://zerogpu.ai/edge

## What this means for Animated Backgrounds

**Static HTML/CSS/JavaScript is no longer an obvious technical blocker.** The published loader makes a static-page proof of concept plausible. This is materially different from the earlier situation in which the SDK was said not to support the static-site use case.

That is not proof that ZeroGPU will approve this particular site or that the current SDK has every control required by the monetization agreement.

## Why this prototype does not start the SDK

The monetization terms require all of the following before production use:

1. Written approval of the specific Developer Offering before integrating the ZeroGPU Offering or supplying compute.
2. Compute participation off by default.
3. Separate, affirmative opt-in consent with a retained record.
4. An easy, effective, continuously available way to disable, revoke, or withdraw participation.
5. A separate disclosure/consent if device resources may be used in the background.
6. Appropriate exclusions for restricted users and devices.

Two implementation issues remain unresolved from the public SDK README reviewed here:

- **In-session stop/withdrawal:** the README describes initialization and says that reloading the host app re-initializes the SDK, but does not document a supported stop/disconnect API. Do not rely on a page reload as the production opt-out until ZeroGPU documents or confirms that it immediately stops workers, WebSockets, and assigned tasks.
- **Durable consent receipt:** the site is static. A browser-only localStorage/sessionStorage entry is not a robust consent ledger. Production needs a durable, privacy-minimised consent/revocation record, likely through a small serverless endpoint, without storing unnecessary personal data.

There is also an age-language issue in the current MSA: its opening section says the services are not intended for users under 18, while the sample end-user consent text elsewhere refers to age 13+. Do not infer which age threshold governs the offering. A written policy clarification is needed before enabling participation on a general-audience site.

## Proposed production architecture (after approval and API confirmation)

- Keep normal Animated Backgrounds browsing completely unaffected when participation is off.
- Present the optional explanation and affirmative consent only after the user chooses to enable it.
- Record the consent text/version, timestamp, site version, and withdrawal state in a durable, privacy-minimised store.
- Load the ZeroGPU CDN loader only after consent, with geolocation collection explicitly disabled.
- Do not enable background-tab or post-navigation compute unless the separate background consent and tested controls are implemented.
- Add a continuously accessible status/control where the user can turn participation off.
- Do not initialise without the approved `edgeOperatorKey`; never commit that key to this repository.
- Test device eligibility, model download size, mobile battery/thermal impact, page responsiveness, task execution, and immediate withdrawal before considering any rollout.

## Prototype page

Open `consent-preview.html` locally to review a consent UI concept. It is intentionally a visual/interaction mock only: it does not load the SDK, contact ZeroGPU, register a device, or contribute compute.

## Current status

- [x] Inspect current static-site architecture.
- [x] Verify that the public package describes a CDN loader usable from a normal page.
- [x] Prepare a consent UI mock in an isolated branch.
- [ ] Obtain written approval for `https://animatedbackgrounds.me`.
- [ ] Confirm the production operator key and current supported SDK build.
- [ ] Confirm supported stop/disconnect and hidden-tab behavior.
- [ ] Build a durable consent/revocation endpoint.
- [ ] Run opt-in-only integration and device tests on a non-production URL.
- [ ] Only then consider a production pull request.
