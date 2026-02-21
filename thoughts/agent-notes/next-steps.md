# Next Steps

## Immediate: Supabase Setup (Manual Steps)

Phase 2 code is written. These manual steps are needed to activate it:

1. **Create a Supabase project** at https://supabase.com/dashboard
2. **Run the migration**: `supabase db push` or apply `supabase/migrations/001_initial.sql` via SQL editor
3. **Deploy the edge function**: `supabase functions deploy analyze-grocery-list --no-verify-jwt` (the `--no-verify-jwt` flag is required due to a gateway JWT rejection issue with new API key format; auth is still enforced via `getUser()` in the function body -- see `thoughts/supabase-jwt-gateway-issue.md`)
4. **Set edge function secret**: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
5. **Enable Apple auth** in Supabase dashboard (Authentication > Providers > Apple)
6. ~~**Add to Info.plist**~~ -- DONE (commit 424e17a): `SUPABASE_URL` and `SUPABASE_ANON_KEY` added to `project.yml` info properties
7. **Regenerate Xcode project**: `cd AIsleList && xcodegen generate`

Note: Since `SUPABASE_URL` and `SUPABASE_ANON_KEY` are baked into `project.yml` (step 6), the app will attempt auth mode on any build. BYOK fallback only occurs if `SupabaseAuthService` init fails. Steps 1-5 and 7 are needed for auth mode to actually function.

## Remaining Phase 2 Cleanup

After Supabase is verified working:
- Delete BYOK files (DirectAnthropicService, ApiKeyInputView, KeychainHelper)
- ~~Update SettingsView~~ -- DONE (commit 588b6d0): dual-mode with Account section (auth) and API Key section (BYOK)
- Show remaining free scans on upload screen

## Still Pending: Task 1.15 (CloudKit)

- Add iCloud capability in Xcode, enable CloudKit, create container `iCloud.com.aislelist.app`
- Add Background Modes with Remote notifications
- No code changes needed -- just Xcode project configuration
- Can be done anytime independently

## Phase 3: Subscriptions + App Store

1. App Store Connect: subscription group, monthly ($4.99) and annual ($39.99) products
2. StoreKit 2: product loading, purchase flow, entitlement checking, transaction listener
3. Paywall: `SubscriptionStoreView` (Apple's built-in UI)
4. Apple webhook: App Store Server Notifications v2 -> Supabase
5. Usage gating: check subscription before scan, show remaining free scans
6. Submission: icon, screenshots, privacy labels, TestFlight, production

## Phase 4: Polish

All independent, pick any order:
- Haptic feedback on item check/completion
- Push notifications for incomplete lists
- Home screen widget (WidgetKit)
- Share lists (UIActivityViewController / CloudKit sharing)
- App Store Optimization
- Analytics (TelemetryDeck or PostHog)

## Business Model Summary

- Apple Small Business Program: 15% commission
- Monthly: $4.99 -> $4.24 net per subscriber
- Annual: $39.99 -> $33.99 net per subscriber
- Break-even: ~3 subscribers (Apple fee only), ~8 subscribers (including Supabase Pro)
