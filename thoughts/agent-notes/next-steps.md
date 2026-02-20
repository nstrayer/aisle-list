# Next Steps

## Immediate (Phase 1 Completion)

### Task 1.15: CloudKit Configuration
- **Blocked on**: Creating iCloud container in Apple Developer portal
- Once container exists: add iCloud capability, enable CloudKit, create container `iCloud.com.yourcompany.aislelist`
- SwiftData automatically syncs @Model entities when CloudKit container is configured
- No code changes needed -- just Xcode project configuration

### Testing on Device
- Phase 1 code is feature-complete pending CloudKit
- App should be testable on-device with BYOK (bring your own API key) flow
- Test: camera capture, photo library import, AI analysis, section selection, checklist, history, settings

## Phase 2: Supabase Backend + Auth

Removes BYOK dependency. Adds server-side API proxy and user accounts.

1. **Supabase project + schema** -- `scan_usage` and `subscriptions` tables with RLS
2. **Edge function** (`analyze-grocery-list`) -- JWT validation, subscription check, free tier (3 scans/month), Anthropic API proxy
3. **Auth service** -- Sign in with Apple + Supabase auth (nonce flow)
4. **Supabase analysis service** -- Drop-in replacement for DirectAnthropicService via protocol
5. **Integration** -- Swap services, add sign-in flow, remove API key UI

SPM dependency needed: `https://github.com/supabase/supabase-swift` (from: "2.0.0")

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
