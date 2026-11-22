/* =====================================================================
   MONETIZATION CONFIG  —  the ONLY file you need to edit to turn on
   revenue providers. Everything is OFF by default.

   ZeroGPU (https://zerogpu.ai/monetize)
   -------------------------------------
   1. Sign up at https://edge.zerogpu.ai/auth/sign-up and create a
      "Browser / Web" supply integration.
   2. Copy the SDK <script> URL and your partner / app key from the
      ZeroGPU dashboard into `zerogpu` below and set enabled: true.
   3. Put the exact start/stop calls from their docs into start()/stop().
      (ZeroGPU's web SDK API is only shown inside their dashboard, so the
      calls below are placeholders — replace them with the real ones.)

   The loader (monetize.js) takes care of:
     - asking the visitor for consent first (opt-in, remembered)
     - only running when the tab is visible, online, not on a metered /
       data-saver connection and (when the browser exposes it) when the
       battery is charging or above `minBattery`
     - pausing when the tab is hidden / offline / battery gets low
     - a "Stop sharing" switch in Settings (gear icon)
   ===================================================================== */
window.AB_MONETIZE = {
  // Ask visitors before using idle compute (strongly recommended — keep true).
  requireConsent: true,
  // Seconds after page load before the consent prompt appears.
  consentDelay: 25,
  // Don't run on battery below this level unless charging (0–1).
  minBattery: 0.35,
  // Skip devices that ask to save data (navigator.connection.saveData).
  respectSaveData: true,

  providers: {
    zerogpu: {
      enabled: false,                      // <-- set true after adding your keys
      name: 'ZeroGPU',
      // SDK script from your ZeroGPU dashboard, e.g. 'https://cdn.zerogpu.ai/web-sdk.js'
      scriptUrl: '',
      // Your partner / app / publisher key from the ZeroGPU dashboard
      key: '',
      // Called once the SDK script is loaded and the visitor has consented.
      // `ctx.key` = key above. Return anything you need later in stop().
      start: async function (ctx) {
        // ---- REPLACE with the call from ZeroGPU's docs, for example: ----
        // const sdk = window.ZeroGPU;
        // const node = await sdk.init({ apiKey: ctx.key, mode: 'idle' });
        // await node.start();
        // return node;
        console.info('[monetize] ZeroGPU start() not configured yet');
        return null;
      },
      // Called when the tab is hidden, the user opts out, battery is low, etc.
      stop: async function (handle) {
        // ---- REPLACE, for example: ----
        // if (handle) await handle.stop();
      }
    }

    // Add more providers here with the same shape { enabled, name, scriptUrl, key, start, stop }.
  },

  // Text shown in the opt-in prompt (keep it honest and clear).
  consentText: {
    title: 'Support Animated Backgrounds for free',
    body: 'Instead of more ads, you can let this site use a small amount of your device\'s idle computing power for AI tasks while the tab is open. It only runs when your device is idle, charging or well charged, and on a normal connection. No personal data is collected and you can stop any time in Settings.',
    accept: 'Yes, I\'ll help',
    decline: 'No thanks'
  }
};
