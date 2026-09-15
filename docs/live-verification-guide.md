# Live Verification Guide: Attestly 2.0.0

Use the Confluence Cloud site `websitestaj.atlassian.net` after the app installation upgrade completes. The Forge development version is deployed as `2.1.0`. Record each result in `08_test_cases.md` as `PASS` or `FAIL` with a short note.

## 1. Page Macro

1. Open a Confluence page containing the Attestly macro.
2. Configure at least one reader and publish the page at version 8 or another known version.
3. Open the page as the assigned reader.
4. Confirm that the macro shows the required state and `I have read and understood this page`.
5. Click the button and verify the confirmation is accepted only when the server's live Confluence version matches the read state. Publish a new version before clicking to verify the page-changed response and that no stale confirmation is written.

Expected: confirmation is pessimistic, the recorded version comes from Confluence, and stale client data cannot create a record.

## 2. Byline Status

1. Open a tracked page as an assigned, unconfirmed reader.
2. Check the byline label for `Confirmation required`.
3. Confirm the page, refresh, and check for `Confirmed`.
4. Change the page version with reconfirmation enabled and verify `Reconfirmation required`.
5. Open the byline dialog and confirm that it exposes the same confirmation action as the macro.

Expected: the label is dynamic per viewer and refreshes after confirmation.

## 3. Config Modal

1. Open the configuration action for a page from the macro or dashboard.
2. Add one user and one group with the multi-select controls.
3. Save and reopen the modal.
4. Verify the assignments, due date, and reconfirm setting persist.
5. Inspect the page content/version history and confirm no assignment data was written to page ADF.

Expected: assignments are stored in Forge KVS, configuration changes create audit records, and group membership is resolved at read time.

## 4. Admin Dashboard and Track Search

1. Open `Read confirmations` as a Confluence admin or compliance manager.
2. Use Track Search to find a page that has no macro and start tracking it with an empty or populated assignment.
3. Verify the tracked page appears with the correct completion percentage and status.
4. Open the page detail and review Outstanding, Confirmed, Voluntary, Cannot view, and History views.
5. Test with a page the current manager cannot view.

Expected: Track Search can start tracking without a macro, restricted pages are omitted completely, and deleted pages use the documented placeholder behavior.

## 5. Export

1. Open Export from the dashboard, detail view, or settings.
2. Select page, space, or site scope and optionally filter by status/date.
3. Download CSV and open it in Excel or a UTF-16LE-aware editor.
4. Verify the BOM, tab delimiters, Turkish characters, headers, outstanding rows, and empty confirmation fields.
5. Download PDF and verify that it contains the same rows and report metadata as the CSV.

Expected: exports are role-gated, visibility-filtered, cursor-complete, and downloaded by the Custom UI surface.

## Installation note

The application is deployed to Forge development as version 2.1.0 and `websitestaj.atlassian.net` reports that its development installation is at the latest version. These checks must be performed in Confluence at `https://websitestaj.atlassian.net/wiki`, not in Jira at `/jira`.
