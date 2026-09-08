# Larivaar Assist

In **Settings → Bani Options**, enable **Larivaar**, then **Larivaar Assist**. Assist is off by default and disabled while Larivaar is off; toggling Larivaar preserves the Assist preference. Both reader layouts alternate verified words between navy (`#11336A`) and rust (`#9A3412`) without introducing visible spaces. Both colours exceed 4.5:1 contrast on the white reader background. Assist takes precedence over Vishraam colours while active and preserves that preference.

## Implementation

- `getLarivaarRenderData` accepts word boundaries only when joining the source words reproduces the supplied Larivaar text exactly. Unknown boundaries display the original text.
- `ReaderVerseText` shares the colour policy between layouts; `LarivaarAssistText` renders spans without storage or navigation dependencies. Alternation restarts per verse, existing zero-width separators are preserved, and parent controls retain accessibility, selection, saving, and layout measurement.
- The preference follows the existing acknowledged settings command and durable write journal. `sehajReadingPreferences_v1` preserves the nine legacy keys and their byte formats. Account snapshots and settings sync include the optional boolean; old snapshots default to off and malformed remote values are ignored.
- No production dependency is added.

## Validation

Focused tests cover exact text and colour rendering, both layouts' long-press interactions, restart persistence, and account snapshot compatibility:

```sh
yarn test --runInBand --watchman=false --runTestsByPath \
  __tests__/components/LarivaarAssistText.test.tsx \
  __tests__/components/ReaderAssistInteraction.test.tsx \
  __tests__/store/readingPreferences.test.ts
```

Native screenshots, capture-environment limitations, and the manual QA checklist are kept in [PR #120](https://github.com/KhalisFoundation/my-sehaj-path-app/pull/120). They document a preview run; the repository does not include a native UI-test suite for this feature.
