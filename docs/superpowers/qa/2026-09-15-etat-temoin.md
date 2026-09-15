# État témoin — 2026-09-15T16:22Z — commit 6f2df66

## npm run lint
```
  95 |     <div className="rounded-xl border bg-card">                                                                                                                                                               react-hooks/static-components

/Users/cluzelgael/DAY 2/from-day1-dashboard/src/lib/prefs.tsx
  47:11  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/Users/cluzelgael/DAY 2/from-day1-dashboard/src/lib/prefs.tsx:47:11
  45 |         };
  46 |         if (Array.isArray(saved.hiddenModules)) {
> 47 |           setHiddenModules(saved.hiddenModules.filter((h) => !CORE_MODULES.has(h)));
     |           ^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  48 |         }
  49 |         if (saved.briefOpenedOn) setBriefOpenedOn(saved.briefOpenedOn);
  50 |       }  react-hooks/set-state-in-effect

/Users/cluzelgael/DAY 2/from-day1-dashboard/src/lib/role.tsx
  66:11  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/Users/cluzelgael/DAY 2/from-day1-dashboard/src/lib/role.tsx:66:11
  64 |         };
  65 |         if (saved.persona === "artist" || saved.persona === "label") {
> 66 |           setPersonaState(saved.persona);
     |           ^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  67 |         }
  68 |         if (saved.focusedArtistId !== undefined) {
  69 |           setFocusedArtistId(saved.focusedArtistId);  react-hooks/set-state-in-effect

✖ 19 problems (9 errors, 10 warnings)

```
## npm test
```

> webapp@0.1.0 test
> vitest run


 RUN  v4.1.10 /Users/cluzelgael/DAY 2/from-day1-dashboard


 Test Files  7 passed (7)
      Tests  194 passed (194)
   Start at  18:22:47
   Duration  1.40s (transform 951ms, setup 0ms, import 1.49s, tests 830ms, environment 1ms)

```
## npm run build
```
> webapp@0.1.0 build
> next build

⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
 We detected multiple lockfiles and selected the directory of /Users/cluzelgael/package-lock.json as the root directory.
 To silence this warning, set `turbopack.root` in your Next.js config, or consider removing one of the lockfiles if it's not needed.
   See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory for more information.
 Detected additional lockfiles: 
   * /Users/cluzelgael/DAY 2/from-day1-dashboard/package-lock.json

▲ Next.js 16.2.10 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 8.9s
  Running TypeScript ...
  Finished TypeScript in 11.2s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/33) ...
  Generating static pages using 7 workers (8/33) 
  Generating static pages using 7 workers (16/33) 
  Generating static pages using 7 workers (24/33) 
✓ Generating static pages using 7 workers (33/33) in 366ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /algo-position
├ ƒ /ar-watch
├ ƒ /audience
├ ƒ /audit
├ ƒ /calculator
├ ƒ /catalog
├ ƒ /comparatif
├ ƒ /contracts
├ ƒ /copilot
├ ƒ /day1-index
├ ƒ /discovery
├ ƒ /fans
├ ƒ /finances
├ ƒ /fractional
├ ƒ /import
├ ƒ /onboardings
├ ƒ /overview
├ ƒ /pulse
├ ƒ /revenue
├ ƒ /rights
├ ƒ /roster
├ ƒ /settings
├ ƒ /splits
├ ƒ /streams
├ ƒ /sync
├ ƒ /team
├ ƒ /tour
├ ƒ /urssaf
└ ƒ /valuation


ƒ  (Dynamic)  server-rendered on demand

```
