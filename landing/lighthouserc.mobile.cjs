/**
 * Lighthouse CI — MOBILE pass. Google indexes the mobile render (mobile-first
 * indexing since 2023), so the landing must clear Core Web Vitals on a throttled
 * phone, not just desktop. Reuses the strict desktop assertions (CWV stay HARD)
 * and only relaxes the load-time WARNs that mobile throttling inflates.
 *
 * Run alongside the desktop pass: `npm run gate:lh:mobile` (part of `gate`).
 */
const base = require('./lighthouserc.cjs');

module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      settings: {
        // Lighthouse's default form factor is mobile with mobile throttling
        // (slow-4G + 4x CPU). Drop the desktop preset and emulate a mid-tier
        // phone explicitly.
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        emulatedUserAgent: true,
        onlyCategories: base.ci.collect.settings.onlyCategories,
      },
    },
    assert: {
      assertions: {
        ...base.ci.assert.assertions,
        // CWV thresholds inherited HARD from desktop (LCP<=2500, CLS<=0.1,
        // TBT<=200). Mobile throttling inflates FCP/SI — keep those as WARNs.
        'first-contentful-paint': ['warn', { maxNumericValue: 2400 }],
        'speed-index': ['warn', { maxNumericValue: 4300 }],
      },
    },
  },
};
