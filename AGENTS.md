<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Receipt architecture
- Keep BS calendar, fiscal-year, validation and customer-matching rules in the browser-safe receipt-rules module so form and server validation share the same rules.
- Store customer master and receipts in Cloud with account-scoped RLS; server functions use the authenticated client, never privileged reads.
- Allocate receipt numbers and save customer/receipt/month rows in one database transaction keyed by account, ward and fiscal year to prevent duplicates and partial saves.
- Keep the ward-first public screen usable before sign-in, but require sign-in for all private record reads and saves.
- Share session, selected ward and fiscal year through AppShell; named workspace routes use authenticated server functions with account-scoped query caching, and sign-out clears private cached data.
- Reuse ReceiptVoucher for new-receipt printing and receipt-history reprints so both show identical ward and fiscal-year details.
- Keep BS month grids in receipt-rules and render the BS date picker with shared popover/button controls; Gregorian month grids must not label receipt dates.
- Use one shared sign-in panel and one AppShell session subscriber; account-keyed caches and the shared sign-out action prevent stale private data.
- Keep email login, signup, resend confirmation and forgot-password actions in the shared email panel; handle recovery on a public reset-password route so confirmation never grants a session prematurely.
- Derive receipt references from the persisted ward, fiscal year and allocated receipt number in receipt-rules; form previews and all voucher reprints use the same formatter without separate counters.
