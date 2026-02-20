# Smart Grocery List: Native iOS App with Subscriptions

Research into rewriting the Smart Grocery List app as a native SwiftUI iOS app with Apple In-App Purchase subscriptions, replacing the current React web app entirely.

**Date:** 2026-02-20
**Branch:** main
**Status:** Research complete

---

## Executive Summary

The app will be rewritten as a native SwiftUI iOS app. No web version will be maintained. Subscriptions are handled exclusively through Apple In-App Purchases with the Small Business Program (15% commission). The backend is Supabase (auth + database + edge functions) which proxies Anthropic API calls.

**Key numbers:**
- API cost per grocery list scan: ~$0.016 (1.6 cents)
- Recommended price: $4.99/month or $39.99/year
- Apple commission (Small Business Program): 15%
- Revenue per monthly subscriber: $4.24
- Fixed costs: $8-33/month (Apple Developer + Supabase)
- Break-even: ~8 paying subscribers

**Tech stack:**
- SwiftUI (iOS 17+)
- Sign in with Apple + Supabase Auth
- Supabase Edge Functions (API proxy)
- Supabase PostgreSQL (user profiles, usage tracking)
- StoreKit 2 (subscriptions)
- Claude Sonnet 4.5 + Haiku 4.5 (AI)

---

## Architecture

```
iOS App (SwiftUI)
  |
  |-- Auth: Sign in with Apple -> Supabase Auth (JWT)
  |-- Payments: StoreKit 2 (Apple IAP)
  |-- Camera: PhotosPicker / AVFoundation
  |
  | supabase.functions.invoke("analyze-grocery-list")
  |
  v
Supabase
  |-- Edge Functions (validate JWT, check subscription, proxy to Anthropic)
  |-- PostgreSQL (profiles, subscription status, usage tracking)
  |-- Auth (JWT issuance + validation)
  |
  v
Anthropic API (server-side key)
  |-- Sonnet 4.5: image analysis (~$0.0135/call)
  |-- Haiku 4.5: category sanity check (~$0.0028/call)
```

### Design Principle: Service Abstraction

All external service interactions (auth, API proxy, storage, subscriptions) go through Swift protocols. Supabase is the concrete implementation, but views and view models never import Supabase directly. This means:
- Supabase can be swapped for CloudKit, Firebase, or a custom backend by writing new protocol conformances
- Services can be migrated independently (e.g., move storage to CloudKit while keeping auth on Supabase)
- Mock implementations enable unit testing and SwiftUI previews
- All Supabase-specific code is confined to `Services/Supabase/`

See [swiftui-architecture-research.md](./swiftui-architecture-research.md) Section 7 for full protocol definitions and implementation details.

---

## Detailed Research

### 1. Backend, Auth & API Costs
**File:** [thoughts/subscription-research.md](./subscription-research.md)

Covers:
- **Auth:** Sign in with Apple as primary method, backed by Supabase Auth. Swift SDK (`supabase-swift`) handles token exchange. Free tier: 50K MAU.
- **Backend proxy:** Supabase Edge Functions. Native JWT validation, 6MB request limit for images, 500K free invocations/month. Calling from Swift is one line: `supabase.functions.invoke(...)`.
- **Database schema:** Profiles table (subscription status, scan count), scans table (usage tracking), Row Level Security policies.
- **API costs:** 1.6 cents per scan (Sonnet + Haiku). Even 100 scans/month = $1.60. Enormous margin at any price point.
- **Subscription design:** Free tier (3 scans/month) + Pro ($4.99/month or $39.99/year).

### 2. SwiftUI App & Apple Payments
**File:** [thoughts/ios-conversion-research.md](./ios-conversion-research.md)

Covers:
- **SwiftUI architecture:** 5-6 screens (onboarding, camera, clarify, grocery list, history, settings/paywall). SwiftData for local storage.
- **StoreKit 2:** `SubscriptionStoreView` handles purchase UI in a few lines. Transaction verification, entitlement checking.
- **Apple IAP:** Small Business Program = flat 15% commission. Apple handles tax collection, refunds, billing.
- **App Store:** Native SwiftUI app has near-zero rejection risk. $99/year developer program. TestFlight for beta.
- **Cost analysis:** $4.24/subscriber/month after Apple's cut. Break-even at 8 subscribers. Projections to 500 subscribers.

### 3. React-to-SwiftUI Component Mapping
**File:** [thoughts/swiftui-component-mapping.md](./swiftui-component-mapping.md)

Covers:
- **Every React component** mapped to its SwiftUI equivalent with migration notes.
- **Key simplifications:** SwipeableItem is unnecessary (SwiftUI has `.swipeActions`), FLIP animations are unnecessary (automatic list animation), `createPortal` becomes `.contextMenu`.
- **GroceryList.tsx** (804 lines) splits into 5 smaller SwiftUI views.
- **Data models:** All TypeScript interfaces mapped to Swift structs.
- **Navigation structure:** State machine maps to NavigationStack with enum routes.

### 4. SwiftUI Architecture & Supabase Swift SDK
**File:** [thoughts/swiftui-architecture-research.md](./swiftui-architecture-research.md)

Covers:
- **Architecture:** `@Observable` macro (not ObservableObject), NavigationStack, `@Environment` for DI.
- **supabase-swift SDK (v2.41.1):** Sign in with Apple nonce flow, edge function calls, typed database queries.
- **Camera:** PhotosPicker + UIImagePickerController wrapper, image compression, base64 conversion.
- **Service abstraction layer:** Protocol definitions for AuthService, GroceryAnalysisService, SubscriptionService, ListStorageService. Supabase implementations isolated in `Services/Supabase/`.
- **Project structure:** Recommended folder layout, app entry point, auth routing.

### 5. StoreKit 2 Subscriptions
**File:** [thoughts/storekit2-research.md](./storekit2-research.md)

Covers:
- **App Store Connect:** Subscription group setup, pricing, introductory offers.
- **StoreKit 2 code:** SubscriptionStoreView, Transaction.currentEntitlements, Transaction.updates listener.
- **Server-side sync:** App Store Server Notifications v2 webhook to Supabase Edge Function.
- **Free tier gating:** Server-side authoritative scan counting with client-side cache.
- **Testing:** StoreKit Configuration File in Xcode, sandbox accounts, TestFlight.
- **RevenueCat vs raw StoreKit 2:** Raw StoreKit 2 is sufficient for a single subscription group.

---

## Cost Model

### Fixed Monthly Costs

| Item | Launch (Free Tier) | Growth (Pro) |
|------|-------------------|--------------|
| Apple Developer Program | $8.25 ($99/yr) | $8.25 |
| Supabase | $0 | $25 |
| **Total** | **$8.25** | **$33.25** |

### Revenue Per Subscriber

| Plan | Price | Apple Cut (15%) | You Keep |
|------|-------|-----------------|----------|
| Monthly | $4.99 | $0.75 | $4.24 |
| Annual | $39.99/yr | $6.00/yr | $33.99/yr ($2.83/mo) |

### Projections at $4.99/month

| Subscribers | Revenue | API Costs | Fixed Costs | Monthly Profit |
|-------------|---------|-----------|-------------|----------------|
| 10 | $42 | $3 | $33 | ~$6 |
| 25 | $106 | $8 | $33 | ~$65 |
| 50 | $212 | $16 | $33 | ~$163 |
| 100 | $424 | $32 | $33 | ~$359 |
| 500 | $2,120 | $160 | $33 | ~$1,927 |

---

## Implementation Phases

### Phase 1: SwiftUI App (No Subscription)
- Set up Xcode project targeting iOS 17+
- Build core screens: camera capture, clarify, grocery list, history
- Use SwiftData for local persistence
- Temporarily use BYOK (user enters their own Anthropic API key) to validate the app works
- Test on physical device

### Phase 2: Backend + Auth
- Create Supabase project
- Implement Sign in with Apple -> Supabase Auth flow
- Build `analyze-grocery-list` edge function (API proxy)
- Create database tables (profiles, scans)
- Replace BYOK with authenticated API proxy calls
- Add usage tracking

### Phase 3: Subscriptions + App Store
- Enroll in Apple Developer Program ($99/year)
- Enroll in Small Business Program
- Create subscription products in App Store Connect ($4.99/month, $39.99/year)
- Implement StoreKit 2 paywall (SubscriptionStoreView)
- Add free tier gate (3 scans/month without subscription)
- Set up App Store Server Notifications v2 -> Supabase webhook for subscription sync
- TestFlight beta
- Submit to App Store

### Phase 4: Polish + Growth
- App Store Optimization (screenshots, keywords, description)
- Push notifications for list reminders
- Widgets (grocery list summary on home screen)
- Share lists feature
- Analytics (usage patterns, conversion funnel)

---

## Key Decisions to Make

1. **Subscription price:** $4.99/month + $39.99/year recommended. Could go lower ($2.99) but slower break-even.
2. **Free tier limit:** 3 scans/month recommended. Enough to try, not enough to avoid paying.
3. **iOS minimum version:** iOS 17+ recommended (SwiftData, modern StoreKit 2). Covers ~90%+ of active devices.
4. **RevenueCat vs raw StoreKit 2:** StoreKit 2 is simple enough for a single subscription. RevenueCat adds value if you need server-side subscription status syncing with Supabase. Decision can be deferred.
5. **Model choice:** Start with Sonnet 4.5 for best accuracy. Test Haiku 4.5 for image analysis -- if quality is acceptable, it cuts API costs by 3x.
