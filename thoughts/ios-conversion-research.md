# iOS App: Native SwiftUI Rewrite

## 1. Approach: Native SwiftUI

The app will be rewritten as a native SwiftUI iOS app, replacing the current Vite+React web app entirely. This is a full rewrite, not a web wrapper.

**Why native SwiftUI over Capacitor/hybrid:**
- Best possible user experience -- truly native iOS feel
- First-class access to Camera, PhotosPicker, StoreKit 2, Sign in with Apple
- No App Store Guideline 4.2 risk (web wrapper scrutiny is eliminated)
- SwiftUI's declarative paradigm is similar to React -- knowledge transfers
- Single platform to target and maintain

**The app is well-suited for a rewrite because it's small:**
- Camera/photo capture screen
- Clarification screen (section selection)
- Grocery checklist organized by store section
- Settings / history
- Subscription paywall

---

## 2. SwiftUI App Architecture

### Screens

| Screen | Purpose | Key Components |
|--------|---------|----------------|
| Onboarding / Sign In | Auth | Sign in with Apple button, Supabase auth |
| Camera / Upload | Capture grocery list photo | PhotosPicker, Camera (AVFoundation or PhotosUI) |
| Clarify | Select which sections to include | List with toggles, section type badges |
| Grocery List | Checklist by store section | Grouped List, swipe actions, checkmarks |
| History | Past lists | NavigationStack with list of sessions |
| Settings | Account, subscription | Subscription status, manage subscription, sign out |
| Paywall | Subscription purchase | SubscriptionStoreView (StoreKit 2) |

### Data Flow

```
PhotosPicker / Camera
  |
  v
Image (Data/UIImage)
  |
  | POST to Supabase Edge Function
  | Authorization: Bearer <supabase_jwt>
  |
  v
Supabase Edge Function
  |
  | 1. Validate JWT
  | 2. Check subscription status
  | 3. Call Anthropic API (Sonnet for analysis, Haiku for sanity check)
  | 4. Return structured sections + categorized items
  |
  v
App receives GrocerySection[] -> ClarifyView -> GroceryListView
```

### Key Swift Packages

| Package | Purpose |
|---------|---------|
| `supabase-swift` | Official Supabase client (auth, database, edge functions) |
| `StoreKit` (framework) | Apple In-App Purchases (built into iOS, no package needed) |
| RevenueCat `purchases-ios` (optional) | Simplifies subscription management |

### Photo Capture

SwiftUI provides two native approaches:

```swift
// Option 1: PhotosPicker (iOS 16+) -- pick from library
import PhotosUI

PhotosPicker(selection: $selectedItem, matching: .images) {
    Label("Choose Photo", systemImage: "photo.on.rectangle")
}

// Option 2: Camera via UIImagePickerController (wrapped in UIViewControllerRepresentable)
// Or use a community SwiftUI camera package
```

Both return image data that can be base64-encoded and sent to the API proxy.

### Local Storage

- **SwiftData** (iOS 17+) for grocery lists, history, and session data -- replaces localStorage
- **UserDefaults** for simple preferences (dark mode, etc.)
- **Keychain** for Supabase auth tokens (supabase-swift handles this automatically)

---

## 3. Apple App Store Requirements

### Apple Developer Program

- **Cost:** $99/year
- **Includes:** App Store distribution, TestFlight beta testing, App Store Connect analytics
- **Requires:** Apple ID, identity verification

### Review Guidelines

With a native SwiftUI app, Guideline 4.2 (minimum functionality) is a non-issue. The app uses native UI, native camera APIs, and provides genuine utility. **Rejection risk: very low.**

Key guidelines to be aware of:
- **3.1.1:** In-app purchases required for digital content/subscriptions (can't link to external payment)
- **2.1:** App must be stable, not crash, handle errors gracefully
- **5.1.1:** Data collection must be disclosed in App Store privacy nutrition labels
- **4.0:** App must work on current iOS version

### TestFlight

- Free, included with Apple Developer Program
- Up to 10,000 external testers
- Internal testers (up to 100) don't require review
- Builds expire after 90 days

---

## 4. Apple In-App Purchases for Subscriptions

### StoreKit 2 (Native Swift)

StoreKit 2 is significantly simpler than StoreKit 1. In a native SwiftUI app, subscription management is straightforward:

```swift
import StoreKit

// Display subscription options with built-in UI
SubscriptionStoreView(groupID: "com.yourapp.grocery.subscription") {
    VStack {
        Text("Smart Grocery List Pro")
        Text("Scan unlimited handwritten grocery lists")
    }
}

// Check subscription status
func checkSubscription() async -> Bool {
    for await result in Transaction.currentEntitlements {
        if case .verified(let transaction) = result {
            return transaction.revocationDate == nil
        }
    }
    return false
}
```

`SubscriptionStoreView` handles the entire purchase flow UI -- product display, price, purchase button, confirmation. A few lines of code vs building a custom paywall.

### Commission Structure

| Scenario | Apple's Cut | Developer Keeps |
|----------|-------------|-----------------|
| Year 1 subscription | 30% | 70% |
| Year 2+ subscription (same subscriber) | 15% | 85% |
| **Small Business Program (any year)** | **15%** | **85%** |

### Small Business Program

- Eligible if prior year proceeds were under $1M
- Flat 15% commission on all subscriptions and IAP
- Must re-qualify annually
- Enrollment is straightforward via App Store Connect

### Revenue Reporting and Tax Handling

- Apple handles sales tax collection in most jurisdictions
- Developer receives net proceeds after commission and applicable taxes
- Monthly financial reports in App Store Connect
- Payment ~33 days after end of each fiscal month
- Apple issues 1099 forms for US developers

### RevenueCat (Optional)

RevenueCat adds a layer on top of StoreKit that provides:
- Server-side receipt validation
- Analytics dashboard
- Webhook integrations (useful for syncing with Supabase)
- Customer management tools

**Pricing:** Free up to $2,500/month tracked revenue, then 1% of tracked revenue.

**Recommendation:** For a simple single-subscription app, StoreKit 2 alone is sufficient. Consider RevenueCat if you need server-side subscription status syncing with Supabase (to gate API proxy access). Alternatively, use Apple's App Store Server Notifications v2 to push subscription events to your Supabase backend directly.

---

## 5. Apple's Rules on External Payments

### Summary for This App

**Not relevant.** Since this is an iOS-only native app:

- All subscriptions go through Apple IAP (required by App Store guidelines)
- No web version means no alternative payment path to offer
- External payment links in the US still incur ~27% commission with mandatory friction-adding disclosure sheets
- Small Business Program at 15% is the best rate available

**Bottom line:** Use Apple IAP with Small Business Program. 15% commission, Apple handles all payment processing, tax collection, refunds, and billing.

---

## 6. Cost Analysis

### Revenue at $4.99/month

| Item | Amount |
|------|--------|
| Subscription price | $4.99/month |
| Apple commission (15% SBP) | -$0.75 |
| **Developer revenue per subscriber** | **$4.24/month** |

### Revenue at $39.99/year (annual plan)

| Item | Amount |
|------|--------|
| Subscription price | $39.99/year ($3.33/month effective) |
| Apple commission (15% SBP) | -$6.00 |
| **Developer revenue per subscriber** | **$33.99/year ($2.83/month effective)** |

Annual plans reduce churn and users save ~33% -- strong conversion incentive.

### Fixed Costs

| Item | Monthly Cost |
|------|-------------|
| Apple Developer Program | $8.25 ($99/year) |
| Supabase (free tier to start) | $0 |
| Supabase Pro (when needed) | $25 |
| **Total fixed** | **$8.25 - $33.25/month** |

### Break-Even

At $4.99/month with Apple IAP (SBP):
- Net revenue per subscriber: $4.24/month
- Break-even on Apple Developer fee alone: ~3 subscribers
- Break-even including Supabase Pro: ~8 subscribers

### Subscriber Projections

| Subscribers | Monthly Revenue | API Costs (~20 scans/user) | Fixed Costs | Profit |
|-------------|----------------|---------------------------|-------------|--------|
| 10 | $42.40 | $3.20 | $33.25 | ~$6 |
| 25 | $106.00 | $8.00 | $33.25 | ~$65 |
| 50 | $212.00 | $16.00 | $33.25 | ~$163 |
| 100 | $424.00 | $32.00 | $33.25 | ~$359 |
| 500 | $2,120.00 | $160.00 | $33.25 | ~$1,927 |

---

## 7. Key Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SwiftUI rewrite effort | Delayed launch | App is small (5-6 screens). SwiftUI's declarative model is familiar from React. |
| StoreKit integration complexity | Delayed launch | StoreKit 2 is much simpler than v1. SubscriptionStoreView handles most UI. |
| Low App Store discovery | Few downloads | ASO (App Store Optimization), social marketing, word of mouth |
| iOS version fragmentation | Reduced audience | Target iOS 17+ (SwiftData, modern StoreKit 2). Covers ~90%+ of active devices. |
| Supabase edge function latency | Poor UX | Edge functions are globally distributed. Anthropic API call is the real bottleneck. |
