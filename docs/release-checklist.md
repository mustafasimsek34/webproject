# Attestly release checklist

- [ ] `npm test` and coverage gates pass.
- [ ] `npm run typecheck` and `npm run lint` pass.
- [ ] `forge lint` passes with no webtrigger or external permissions.
- [ ] Scope snapshot matches the Marketplace security statement.
- [ ] Macro confirms pessimistically and retries after a storage error.
- [ ] Group membership, cannot-view, deleted-page, and restored-page behavior verified.
- [ ] Dashboard pagination verified with 500 tracked pages.
- [ ] CSV is UTF-16LE BOM-prefixed and tab-delimited; PDF and CSV rows match.
- [ ] Export access is role-gated and restricted pages are omitted.
- [ ] Settings retention notice and export-all flow verified.
