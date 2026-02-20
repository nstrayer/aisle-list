# StoreKit 2 Subscription Implementation Research

Research for implementing auto-renewable subscriptions in the Grocery List Scanner iOS app.

**Subscription Model:**
- Free tier: 3 scans/month (requires sign-up)
- Pro monthly: $4.99/month (unlimited scans)
- Pro annual: $39.99/year (unlimited scans)

**Backend:** Supabase (Edge Functions + PostgreSQL)

---

## 1. App Store Connect Setup

### Creating Auto-Renewable Subscription Products

In App Store Connect, subscriptions are organized into **subscription groups**. All plans that provide the same core feature set should live in one group.

**Steps:**

1. Navigate to your app in App Store Connect
2. Go to **Monetization > Subscriptions**
3. Create a **Subscription Group** (e.g., "Pro Access")
4. Add subscription products within the group

**Our products:**

| Reference Name | Product ID | Duration | Price |
|---|---|---|---|
| Pro Monthly | `com.yourapp.pro.monthly` | 1 Month | $4.99 |
| Pro Annual | `com.yourapp.pro.annual` | 1 Year | $39.99 |

### Subscription Groups

A subscription group is a collection of subscription products that provide the same core benefit at different durations or tiers. Key rules:

- Users can only have **one active subscription per group** at a time
- Within a group, products have a **service level** (rank). Higher-level plans are "upgrades," lower-level plans are "downgrades"
- **Upgrades** take effect immediately; the user gets a prorated refund for the remaining time
- **Downgrades** take effect at the end of the current billing period
- **Crossgrades** (same level) take effect at the next renewal if durations differ, or immediately if durations match

For our app, both monthly and annual are the same service level (both provide "Pro" access). Set them at the same level in the group.

### Pricing Tiers and Territory Pricing

- Apple provides **900 price points** ranging from $0.29 to $10,000
- Set a **base price** in your primary currency; Apple auto-generates equivalent prices in 43 currencies across 175+ regions
- You can customize prices per storefront if needed
- Apple handles VAT/tax calculation and collection in 80+ regions

### Introductory Offers

Three types of introductory offers (available to new subscribers only):

1. **Free Trial** - e.g., 7-day free trial before $4.99/month kicks in
2. **Pay Up Front** - e.g., $1.99 for the first 3 months, then $4.99/month
3. **Pay As You Go** - e.g., $0.99/month for 3 months, then $4.99/month

**Recommendation for our app:** A 7-day free trial on the monthly plan is the simplest way to reduce friction. Configure this in App Store Connect under the subscription product's "Introductory Offers" section.

### Promotional Offers

- Available to **existing or lapsed** subscribers (not new ones)
- Require a **server-side signature** to initiate (the app requests a signed offer from your backend)
- Useful for win-back campaigns (e.g., "Come back for $0.99/month for 2 months")
- Each offer needs a unique identifier configured in App Store Connect

---

## 2. StoreKit 2 Implementation in SwiftUI

### Architecture Overview

The recommended pattern is a **Store manager** class that:
1. Loads products from the App Store
2. Handles purchases
3. Monitors transaction updates
4. Tracks entitlement state

```swift
import StoreKit

@MainActor
@Observable
final class StoreManager {
    // Product IDs
    static let proMonthlyID = "com.yourapp.pro.monthly"
    static let proAnnualID = "com.yourapp.pro.annual"

    private(set) var products: [Product] = []
    private(set) var isProSubscriber: Bool = false
    private(set) var activeTransaction: Transaction? = nil

    private var transactionListener: Task<Void, Error>? = nil

    init() {
        // Start listening for transaction updates immediately
        transactionListener = listenForTransactions()

        // Check current entitlements on launch
        Task {
            await updateSubscriptionStatus()
            await loadProducts()
        }
    }

    deinit {
        transactionListener?.cancel()
    }
}
```

### Loading Products

```swift
extension StoreManager {
    func loadProducts() async {
        do {
            let productIDs = [Self.proMonthlyID, Self.proAnnualID]
            products = try await Product.products(for: productIDs)
            // Sort so monthly appears first
            products.sort { $0.price < $1.price }
        } catch {
            print("Failed to load products: \(error)")
            products = []
        }
    }
}
```

### Purchase Flow

```swift
extension StoreManager {
    func purchase(_ product: Product) async throws -> Transaction? {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            // StoreKit 2 automatically verifies the JWS signature
            let transaction = try checkVerified(verification)

            // Update our subscription status
            await updateSubscriptionStatus()

            // Always finish the transaction
            await transaction.finish()

            return transaction

        case .userCancelled:
            return nil

        case .pending:
            // Transaction is pending (e.g., Ask to Buy)
            return nil

        @unknown default:
            return nil
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }
}
```

### Transaction.currentEntitlements -- Checking Active Subscriptions

```swift
extension StoreManager {
    func updateSubscriptionStatus() async {
        var foundActive = false

        // Iterate over all current entitlements
        for await result in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(result) else {
                continue
            }

            // Check if it's one of our subscription products
            if transaction.productID == Self.proMonthlyID ||
               transaction.productID == Self.proAnnualID {
                // Check the transaction hasn't been revoked
                if transaction.revocationDate == nil {
                    foundActive = true
                    activeTransaction = transaction
                }
            }
        }

        isProSubscriber = foundActive
        if !foundActive {
            activeTransaction = nil
        }
    }
}
```

**Key point:** `Transaction.currentEntitlements` returns all active entitlements across all devices for the current Apple ID. This eliminates the need for explicit "Restore Purchases" logic, though Apple still requires a restore button in the UI.

### Transaction.updates Listener -- Real-Time Status Changes

```swift
extension StoreManager {
    private func listenForTransactions() -> Task<Void, Error> {
        Task.detached {
            // This async sequence emits whenever a transaction changes
            // (new purchase, renewal, revocation, refund, etc.)
            for await result in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(result)

                    // Update subscription status
                    await self.updateSubscriptionStatus()

                    // Finish the transaction
                    await transaction.finish()
                } catch {
                    print("Transaction verification failed: \(error)")
                }
            }
        }
    }
}
```

**Important:** Start this listener as early as possible (app launch). It catches transactions that may have completed while the app was not running -- renewals, family sharing grants, refunds, etc.

### Restoring Purchases

With StoreKit 2, explicit restore is mostly unnecessary because `Transaction.currentEntitlements` always reflects the current state. However, Apple requires a visible "Restore Purchases" button. You can trigger a sync:

```swift
extension StoreManager {
    func restorePurchases() async {
        // This syncs with the App Store and refreshes entitlements
        try? await AppStore.sync()
        await updateSubscriptionStatus()
    }
}
```

### SubscriptionStoreView -- Apple's Built-In Paywall

The simplest way to build a paywall. Apple handles rendering, localization, and purchase flow:

```swift
import SwiftUI
import StoreKit

struct PaywallView: View {
    // The subscription group ID from App Store Connect
    let groupID = "YOUR_SUBSCRIPTION_GROUP_ID"

    var body: some View {
        SubscriptionStoreView(groupID: groupID) {
            // Custom marketing content header
            VStack(spacing: 16) {
                Image(systemName: "sparkles")
                    .font(.system(size: 60))
                    .foregroundStyle(.blue)

                Text("Unlock Unlimited Scans")
                    .font(.title.bold())

                Text("Scan as many handwritten grocery lists as you want")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                // Feature list
                VStack(alignment: .leading, spacing: 8) {
                    FeatureRow(icon: "camera.fill", text: "Unlimited list scans")
                    FeatureRow(icon: "brain", text: "AI-powered recognition")
                    FeatureRow(icon: "clock.fill", text: "Full scan history")
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .backgroundStyle(.clear)
        .subscriptionStoreButtonLabel(.multiline)
        .subscriptionStoreControlStyle(.prominentPicker)
        .storeButton(.visible, for: .restorePurchases)
        .storeButton(.visible, for: .redeemCode)
        .onInAppPurchaseCompletion { product, result in
            if case .success(.success(_)) = result {
                // Purchase succeeded - dismiss paywall
            }
        }
    }
}
```

#### SubscriptionStoreView Customization Options

**Button label styles:**
```swift
.subscriptionStoreButtonLabel(.multiline)          // Price inside button, multi-line
.subscriptionStoreButtonLabel(.displayName)         // Show plan name instead of action
.subscriptionStoreButtonLabel(.multiline.displayName) // Both
```

**Control styles:**
```swift
.subscriptionStoreControlStyle(.picker)            // Picker wheel (default on iPhone)
.subscriptionStoreControlStyle(.prominentPicker)   // Picker with shadow/ring emphasis
.subscriptionStoreControlStyle(.buttons)           // Individual button per plan
```

**Background customization:**
```swift
.containerBackground(for: .subscriptionStoreFullHeight) {
    LinearGradient(colors: [.blue, .purple], startPoint: .top, endPoint: .bottom)
}
```

**Sign-in action (for cross-platform account linking):**
```swift
.subscriptionStoreSignInAction {
    showSignInSheet = true
}
```

**Show upgrade options only for existing subscribers:**
```swift
SubscriptionStoreView(
    groupID: groupID,
    visibleRelationships: .upgrade
)
```

### Manual Paywall with ProductView / StoreView

If you need more control than SubscriptionStoreView provides:

```swift
struct ManualPaywallView: View {
    @Environment(StoreManager.self) var store
    @State private var isPurchasing = false

    var body: some View {
        VStack(spacing: 20) {
            // Marketing content...

            ForEach(store.products) { product in
                ProductCard(product: product) {
                    Task {
                        isPurchasing = true
                        defer { isPurchasing = false }
                        _ = try? await store.purchase(product)
                    }
                }
            }
        }
        .disabled(isPurchasing)
    }
}

struct ProductCard: View {
    let product: Product
    let onPurchase: () -> Void

    var body: some View {
        VStack {
            Text(product.displayName)
                .font(.headline)
            Text(product.displayPrice)
                .font(.title2.bold())
            if let subscription = product.subscription {
                Text(subscription.subscriptionPeriod.debugDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Button("Subscribe", action: onPurchase)
                .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
```

### Subscription Status Checking with SubscriptionInfo

```swift
extension StoreManager {
    /// Detailed subscription status including renewal info
    func getSubscriptionStatus() async -> Product.SubscriptionInfo.Status? {
        guard let product = products.first,
              let subscription = product.subscription else {
            return nil
        }

        let statuses = try? await subscription.status

        // Find the most recent active status
        return statuses?.first { status in
            status.state == .subscribed || status.state == .inGracePeriod
        }
    }

    /// Check detailed renewal info
    func getRenewalInfo() async -> Product.SubscriptionInfo.RenewalInfo? {
        guard let status = await getSubscriptionStatus() else { return nil }
        return try? status.renewalInfo.payloadValue
    }
}
```

### SwiftUI View Modifiers for Status

```swift
struct ContentView: View {
    @Environment(StoreManager.self) var store

    var body: some View {
        NavigationStack {
            // Main app content
        }
        // Built-in modifier to react to subscription status changes
        .subscriptionStatusTask(for: "YOUR_GROUP_ID") { taskState in
            if let statuses = taskState.value {
                // Update store based on statuses
                let hasActive = statuses.contains { status in
                    status.state == .subscribed || status.state == .inGracePeriod
                }
                // Update UI accordingly
            }
        }
    }
}
```

---

## 3. Server-Side Subscription Verification

### Why Server-Side Verification?

For our app, the backend (Supabase) gates API proxy calls. The server needs to know:
- Is this user a Pro subscriber? (allow unlimited scans)
- Is this user on free tier? (count scans, enforce limit)

Two approaches work together:
1. **App Store Server Notifications V2** -- Apple pushes subscription lifecycle events to your webhook
2. **App Store Server API** -- You query Apple for transaction/subscription status on demand

### App Store Server Notifications V2

#### Setup in App Store Connect

1. Go to your app in App Store Connect
2. Navigate to **General > App Information**
3. Scroll to **App Store Server Notifications**
4. Enter your **Production Server URL**: `https://your-project.supabase.co/functions/v1/apple-webhook`
5. Enter your **Sandbox Server URL**: `https://your-project.supabase.co/functions/v1/apple-webhook-sandbox`
6. Select **Version 2** (recommended)
7. Save

If you only set a production URL, Apple sends both production and sandbox notifications there.

#### Notification Types

Here are the key notification types and subtypes for subscription management:

| Notification Type | Subtype | Meaning |
|---|---|---|
| `SUBSCRIBED` | `INITIAL_BUY` | New subscription purchased |
| `SUBSCRIBED` | `RESUBSCRIBE` | Previously lapsed user re-subscribed |
| `DID_RENEW` | (none) | Subscription successfully renewed |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_ENABLED` | User re-enabled auto-renew |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_DISABLED` | User turned off auto-renew (will expire at period end) |
| `DID_CHANGE_RENEWAL_PREF` | `UPGRADE` | User upgraded to higher-tier plan |
| `DID_CHANGE_RENEWAL_PREF` | `DOWNGRADE` | User will downgrade at next renewal |
| `EXPIRED` | `VOLUNTARY` | Subscription expired after user cancelled |
| `EXPIRED` | `BILLING_RETRY_PERIOD` | Expired after billing retry failed |
| `EXPIRED` | `PRICE_INCREASE` | Expired because user didn't consent to price increase |
| `GRACE_PERIOD_EXPIRED` | (none) | Grace period ended without successful payment |
| `DID_FAIL_TO_RENEW` | `GRACE_PERIOD` | Renewal failed, grace period started |
| `DID_FAIL_TO_RENEW` | (none) | Renewal failed, no grace period |
| `REFUND` | (none) | Apple issued a refund |
| `REVOKE` | (none) | Family Sharing access revoked |
| `OFFER_REDEEMED` | (various) | User redeemed a promotional/offer code |
| `RENEWAL_EXTENDED` | (none) | Apple extended the renewal date (e.g., due to outage) |
| `CONSUMPTION_REQUEST` | (none) | Apple is requesting consumption info for a refund case |

#### JWS Signed Notification Payload

Apple sends notifications as a **JWS (JSON Web Signature)** signed payload. The structure:

```
POST /your-webhook-endpoint
Content-Type: application/json

{
    "signedPayload": "<JWS-signed-string>"
}
```

The JWS has three parts (header.payload.signature) separated by dots. The payload, when decoded, contains:

```json
{
    "notificationType": "DID_RENEW",
    "subtype": null,
    "notificationUUID": "unique-id",
    "data": {
        "appAppleId": 123456,
        "bundleId": "com.yourapp",
        "bundleVersion": "1.0",
        "environment": "Production",
        "signedTransactionInfo": "<JWS>",
        "signedRenewalInfo": "<JWS>"
    },
    "signedDate": 1234567890000
}
```

Both `signedTransactionInfo` and `signedRenewalInfo` are themselves JWS-signed and need to be decoded separately.

#### Supabase Edge Function Webhook Implementation

```typescript
// supabase/functions/apple-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

// Apple's root certificates for JWS verification
const APPLE_ROOT_CA_G3_URL =
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { signedPayload } = body;

    // 1. Decode and verify the JWS
    const payload = await verifyAndDecodeNotification(signedPayload);

    // 2. Extract the notification details
    const { notificationType, subtype, data } = payload;

    // 3. Decode the signed transaction info
    const transactionInfo = await verifyAndDecodeJWS(
      data.signedTransactionInfo
    );
    const renewalInfo = data.signedRenewalInfo
      ? await verifyAndDecodeJWS(data.signedRenewalInfo)
      : null;

    // 4. Get the original transaction ID (groups all renewals together)
    const {
      originalTransactionId,
      transactionId,
      productId,
      expiresDate,
      revocationDate,
    } = transactionInfo;

    // 5. Map Apple's appAccountToken to our user ID
    // (We set this during purchase - see client-side code)
    const appAccountToken = transactionInfo.appAccountToken;

    // 6. Update our database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine subscription status from notification
    const status = determineStatus(notificationType, subtype, transactionInfo);

    await supabase.from("subscriptions").upsert(
      {
        user_id: appAccountToken, // Our Supabase user ID
        original_transaction_id: originalTransactionId,
        product_id: productId,
        status: status,
        expires_at: expiresDate ? new Date(expiresDate).toISOString() : null,
        revoked_at: revocationDate
          ? new Date(revocationDate).toISOString()
          : null,
        last_notification_type: notificationType,
        last_notification_subtype: subtype,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "original_transaction_id",
      }
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    // Return 200 even on error to prevent Apple from retrying
    // (log the error for debugging)
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
});

function determineStatus(
  notificationType: string,
  subtype: string | null,
  transactionInfo: any
): string {
  switch (notificationType) {
    case "SUBSCRIBED":
      return "active";
    case "DID_RENEW":
      return "active";
    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD" ? "grace_period" : "billing_retry";
    case "EXPIRED":
      return "expired";
    case "GRACE_PERIOD_EXPIRED":
      return "expired";
    case "REFUND":
    case "REVOKE":
      return "revoked";
    case "DID_CHANGE_RENEWAL_STATUS":
      // Still active, just indicates future intent
      return transactionInfo.expiresDate > Date.now() ? "active" : "expired";
    default:
      return "unknown";
  }
}

async function verifyAndDecodeNotification(signedPayload: string) {
  // Decode the JWS header to extract the certificate chain
  const [headerB64] = signedPayload.split(".");
  const header = JSON.parse(atob(headerB64));
  const certChain = header.x5c; // Array of DER-encoded certificates

  // Verify the certificate chain leads to Apple's root CA
  // In production, pin to Apple's root certificate
  // For a simpler approach, use the apple-app-store-server-library

  // Decode the payload
  const [, payloadB64] = signedPayload.split(".");
  const payload = JSON.parse(atob(payloadB64));
  return payload;
}

async function verifyAndDecodeJWS(jws: string) {
  const [, payloadB64] = jws.split(".");
  const payload = JSON.parse(atob(payloadB64));
  return payload;
}
```

**Important:** In production, you must properly verify the JWS certificate chain. Apple provides an official library: `apple-app-store-server-library` (available for Node.js, Python, Java, Swift). For a Deno/Supabase Edge Function, you may need to implement JWS verification manually using `jose` or port the logic from Apple's library.

#### Simpler Approach: Apple's Official Node.js Library

```typescript
// If using Node.js-compatible runtime:
import {
  AppStoreServerNotificationDecoder,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

const verifier = new SignedDataVerifier(
  [appleRootCACert],
  true, // enableOnlineChecks
  Environment.PRODUCTION,
  bundleId,
  appAppleId
);

const decoder = new AppStoreServerNotificationDecoder(verifier);
const payload = await decoder.decodeNotification(signedPayload);
```

### Linking Purchases to Supabase Users

When making a purchase on the client, pass the Supabase user ID as `appAccountToken`:

```swift
extension StoreManager {
    func purchase(_ product: Product, userID: UUID) async throws -> Transaction? {
        // appAccountToken links this purchase to our backend user
        let result = try await product.purchase(
            options: [.appAccountToken(userID)]
        )
        // ... handle result as before
    }
}
```

The `appAccountToken` appears in every notification's `signedTransactionInfo`, allowing you to map App Store transactions to your database users.

### Database Schema for Subscriptions

```sql
-- Supabase migration
CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    original_transaction_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'grace_period', 'billing_retry', 'expired', 'revoked'
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_notification_type TEXT,
    last_notification_subtype TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick user lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS: users can read their own subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);
```

### Checking Subscription on API Calls

```typescript
// supabase/functions/scan-list/index.ts (the API proxy)
async function checkSubscriptionAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check for active subscription
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .in("status", ["active", "grace_period"])
    .order("expires_at", { ascending: false })
    .limit(1)
    .single();

  if (sub && new Date(sub.expires_at) > new Date()) {
    return { allowed: true }; // Pro subscriber
  }

  // Check free tier usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("scan_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if ((count ?? 0) < 3) {
    return { allowed: true }; // Free tier, under limit
  }

  return { allowed: false, reason: "scan_limit_reached" };
}
```

---

## 4. Free Tier Gating (3 Scans/Month)

### Recommended Approach: Server-Side with Client-Side Cache

**Server-side is authoritative.** The client caches the count for UX responsiveness.

#### Server-Side: Usage Tracking Table

```sql
CREATE TABLE scan_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_usage_user_month
ON scan_usage(user_id, created_at);
```

#### Server-Side: Check + Record in the Scan Edge Function

```typescript
// In the scan endpoint, before proxying to Anthropic:
const { allowed, reason } = await checkSubscriptionAccess(supabase, userId);

if (!allowed) {
  return new Response(
    JSON.stringify({
      error: "scan_limit_reached",
      message: "You have used all 3 free scans this month",
      upgradeRequired: true,
    }),
    { status: 403 }
  );
}

// If allowed, record the usage BEFORE making the API call
await supabase.from("scan_usage").insert({ user_id: userId });

// Then proxy to Anthropic...
```

#### Client-Side: Usage Display

```swift
@Observable
final class UsageManager {
    private(set) var scansUsedThisMonth: Int = 0
    private(set) var scanLimit: Int = 3
    private(set) var isProSubscriber: Bool = false

    var scansRemaining: Int {
        isProSubscriber ? .max : max(0, scanLimit - scansUsedThisMonth)
    }

    var canScan: Bool {
        isProSubscriber || scansUsedThisMonth < scanLimit
    }

    func fetchUsage() async {
        // Query Supabase for current month's usage count
        let startOfMonth = Calendar.current.date(
            from: Calendar.current.dateComponents(
                [.year, .month], from: Date()
            )
        )!

        let response = try? await supabase
            .from("scan_usage")
            .select("id", head: true, count: .exact)
            .eq("user_id", currentUserId)
            .gte("created_at", startOfMonth.ISO8601Format())
            .execute()

        scansUsedThisMonth = response?.count ?? 0
    }
}
```

#### Client-Side: Scan Button with Gating

```swift
struct ScanButton: View {
    @Environment(UsageManager.self) var usage
    @Environment(StoreManager.self) var store
    @State private var showPaywall = false

    var body: some View {
        VStack {
            if !usage.isProSubscriber {
                Text("\(usage.scansRemaining) scans remaining this month")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Button("Scan List") {
                if usage.canScan {
                    // Proceed with scan
                } else {
                    showPaywall = true
                }
            }
            .disabled(!usage.canScan && !usage.isProSubscriber)
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }
}
```

### Why Server-Side Gating?

- **Tamper-proof:** Client-side only gating can be bypassed by modifying the app
- **Consistent:** Works across devices and reinstalls
- **Auditable:** You have a record of all scans
- **Monthly reset is automatic:** Just query by date range

The client-side cache is purely for UX -- showing the user their remaining scans without a network call.

---

## 5. Testing

### StoreKit Configuration File (Local Testing in Xcode)

The fastest way to test without App Store Connect:

1. **File > New > File > StoreKit Configuration File**
2. Name it `Products.storekit`
3. Add subscription products matching your product IDs:
   - Click "+" > "Add Auto-Renewable Subscription"
   - Set Reference Name, Product ID, Price, Duration
   - Create a Subscription Group

4. **Edit Scheme > Run > Options > StoreKit Configuration** > Select your `.storekit` file

This enables testing purchases in the Simulator and on device without connecting to App Store Connect.

**StoreKit Configuration File Example:**
```json
{
  "identifier": "com.yourapp.pro.monthly",
  "type": "AutoRenewableSubscription",
  "referenceName": "Pro Monthly",
  "subscriptionGroupID": "pro_access",
  "subscriptionPeriod": "P1M",
  "price": 4.99
}
```

### Sandbox Testing

For testing against App Store Connect's real product configurations:

1. **Create sandbox test accounts** in App Store Connect > Users and Access > Sandbox > Testers
2. On your test device: Settings > App Store > Sandbox Account > sign in with test account
3. Build and run your app on the device
4. Purchases use sandbox environment (no real charges)

**Sandbox subscription behavior:**
- Subscriptions renew at accelerated rates for testing:

| Real Duration | Sandbox Duration |
|---|---|
| 1 week | 3 minutes |
| 1 month | 5 minutes |
| 2 months | 10 minutes |
| 3 months | 15 minutes |
| 6 months | 30 minutes |
| 1 year | 1 hour |

- Subscriptions auto-renew up to **6 times** in sandbox, then expire
- You can manage sandbox subscriptions on the test device in Settings

### Transaction Manager in Xcode

When using a StoreKit Configuration File:
- **Debug > StoreKit > Manage Transactions** opens the Transaction Manager
- You can:
  - View all transactions
  - Delete transactions (to reset state)
  - Approve/decline pending transactions (Ask to Buy)
  - Trigger refunds
  - Expire subscriptions
  - Simulate billing issues

### StoreKitTest Framework (Automated Testing)

```swift
import XCTest
import StoreKitTest

final class SubscriptionTests: XCTestCase {
    var session: SKTestSession!

    override func setUp() async throws {
        // Load the StoreKit configuration file
        session = try SKTestSession(configurationFileNamed: "Products")
        session.disableDialogs = true  // Skip confirmation dialogs
        session.clearTransactions()     // Start fresh
    }

    func testPurchaseMonthly() async throws {
        let store = StoreManager()
        await store.loadProducts()

        let monthly = store.products.first {
            $0.id == StoreManager.proMonthlyID
        }!

        let transaction = try await store.purchase(monthly)
        XCTAssertNotNil(transaction)

        await store.updateSubscriptionStatus()
        XCTAssertTrue(store.isProSubscriber)
    }

    func testSubscriptionExpiration() async throws {
        let store = StoreManager()
        await store.loadProducts()

        // Purchase
        let monthly = store.products.first {
            $0.id == StoreManager.proMonthlyID
        }!
        _ = try await store.purchase(monthly)

        // Simulate expiration
        try session.expireSubscription(productIdentifier: StoreManager.proMonthlyID)

        await store.updateSubscriptionStatus()
        XCTAssertFalse(store.isProSubscriber)
    }

    func testBillingRetry() async throws {
        // Enable billing retry grace period
        session.billingGracePeriodEnabled = true

        let store = StoreManager()
        await store.loadProducts()

        let monthly = store.products.first {
            $0.id == StoreManager.proMonthlyID
        }!
        _ = try await store.purchase(monthly)

        // Simulate failed renewal
        try session.forceRenewalOfSubscription(
            productIdentifier: StoreManager.proMonthlyID
        )
        // User should still have access during grace period
    }
}
```

### TestFlight Testing

- TestFlight builds use the **sandbox** environment
- External testers (up to 10,000) can test the full purchase flow
- Purchases are free but behave like real transactions
- Good for testing the complete flow including server notifications

### Common Pitfalls and Debugging Tips

1. **Products array is empty:** Ensure your product IDs match exactly between code and App Store Connect / StoreKit config file. Check that you have a Paid Apps agreement in App Store Connect.

2. **Transactions not finishing:** Always call `await transaction.finish()`. Unfinished transactions cause StoreKit to re-deliver them on every app launch.

3. **Transaction.updates not firing:** Make sure the listener starts at app launch (in `init()` or `@main App` struct), not in a view.

4. **Sandbox account issues:** Sandbox accounts can get into weird states. Create a new one if testing gets stuck. Don't use your real Apple ID.

5. **StoreKit config vs App Store Connect:** StoreKit Configuration File testing does NOT send server notifications. Use sandbox testing if you need to test your webhook.

6. **Verification errors:** In sandbox, JWS verification can behave differently. Test with `Transaction.unfinished` and `Transaction.currentEntitlements` which handle verification automatically.

---

## 6. RevenueCat vs Raw StoreKit 2

### For Our Simple Single-Subscription-Group App

| Aspect | Raw StoreKit 2 | RevenueCat |
|---|---|---|
| **Complexity** | Medium - manageable for our simple case | Low - SDK handles most edge cases |
| **Server webhook** | Must build and maintain our own | RevenueCat can POST to our Supabase endpoint |
| **JWS verification** | Must implement (or use Apple's library) | RevenueCat handles this |
| **Dashboard/Analytics** | Build your own or use App Store Connect | Rich dashboard included |
| **Cross-platform** | Apple only (which is fine for us) | iOS, Android, web |
| **Cost** | Free | Free up to $2.5K MTR, then 1% of revenue |
| **Vendor lock-in** | None | Some - entitlement logic lives in RevenueCat |
| **Latency** | Direct to Apple | Extra hop through RevenueCat servers |
| **Control** | Full control | Less control over edge cases |
| **Offline support** | Built into StoreKit 2 | Built into SDK |

### What RevenueCat Adds

1. **Entitlements abstraction:** Check `customerInfo.entitlements["pro"]?.isActive` instead of iterating transactions
2. **Webhook to your backend:** RevenueCat can POST subscription events to a URL (your Supabase Edge Function), saving you from implementing Apple's JWS verification
3. **Analytics dashboard:** Subscription metrics, MRR, churn, trial conversion rates
4. **Customer lookup:** Search by user ID, email, or transaction ID
5. **A/B testing paywalls:** Test different offerings without app updates
6. **Grace period / billing retry handling:** Automatically handled
7. **Promotional offer generation:** Server-side offer signing built-in

### RevenueCat Pricing (as of 2025)

- **Free:** Up to $2,500/month in tracked revenue (MTR). Includes core SDK, webhook, basic analytics.
- **Starter:** $2,500+ MTR. 1% of revenue over $2,500. Adds charts, experiments, targeting.
- **Pro:** Custom pricing for larger apps. Adds advanced analytics and support.

At $4.99/month, you would need ~500 paying subscribers to exceed the free tier ($2,500 MTR). For a new app, the free tier is more than sufficient.

### Recommendation

**Start with raw StoreKit 2.** Here is why:

1. Our subscription model is simple (one group, two durations, same entitlement)
2. StoreKit 2's API is dramatically simpler than StoreKit 1
3. `SubscriptionStoreView` handles the entire paywall UI
4. `Transaction.currentEntitlements` handles entitlement checking
5. Building the webhook is straightforward (we already need Supabase Edge Functions for the AI proxy)
6. We avoid a dependency and potential vendor lock-in

**Consider switching to RevenueCat later if:**
- We add Android support (RevenueCat unifies cross-platform)
- We want advanced analytics without building them
- We add multiple subscription tiers with complex entitlements
- We want A/B testing on paywalls without app updates
- Maintaining the webhook/JWS verification becomes a burden

### If We Do Use RevenueCat

The integration is straightforward:

```swift
import RevenueCat

// App launch
Purchases.configure(
    with: .init(withAPIKey: "appl_YOUR_KEY")
        .with(appUserID: supabaseUserId)
)

// Check subscription
let customerInfo = try await Purchases.shared.customerInfo()
let isPro = customerInfo.entitlements["pro"]?.isActive == true

// Show paywall (using RevenueCat's PaywallView or our own)
let offerings = try await Purchases.shared.offerings()
if let current = offerings.current {
    // Display packages
}

// Purchase
let result = try await Purchases.shared.purchase(package: monthlyPackage)
let isPro = result.customerInfo.entitlements["pro"]?.isActive == true
```

And on the server side, configure RevenueCat's webhook to POST to your Supabase Edge Function. RevenueCat sends normalized events, so you don't need to deal with JWS verification.

---

## 7. Edge Cases

### Grace Periods and Billing Retry

When a subscription renewal fails (e.g., expired credit card):

1. **Billing Retry Period:** Apple retries the charge for up to 60 days
2. **Grace Period** (opt-in in App Store Connect): Gives the user continued access for 6 or 16 days while Apple retries billing
3. During grace period, `Transaction.currentEntitlements` still includes the subscription
4. The subscription state will be `.inBillingRetryPeriod` or `.inGracePeriod`

**Enable Grace Period** in App Store Connect > App > Subscriptions > Subscription Group > Billing Grace Period. This reduces involuntary churn.

**Handle in code:**
```swift
func hasAccess(status: Product.SubscriptionInfo.Status) -> Bool {
    switch status.state {
    case .subscribed, .inGracePeriod:
        return true  // Full access
    case .inBillingRetryPeriod:
        return false // Or true, depending on your policy
    case .expired, .revoked:
        return false
    default:
        return false
    }
}
```

### Subscription Offers and Win-Back

**Offer Codes** (redeemable codes you generate in App Store Connect):
```swift
// Show the offer code redemption sheet
.offerCodeRedemption(isPresented: $showOfferRedemption) { result in
    // Handle result
}
```

**Win-back offers** (iOS 18+): Apple can automatically present offers to lapsed subscribers in the App Store. Configure in App Store Connect.

### Family Sharing for Subscriptions

- Enable in App Store Connect for your subscription group
- One family member's purchase grants access to up to 5 family members
- `Transaction.ownershipType` tells you if the user purchased directly (`.purchased`) or has family access (`.familyShared`)
- Revocation: if the purchaser cancels or leaves the family group, family members lose access (you receive a `REVOKE` notification)

```swift
// Check if user owns vs has family shared access
if let transaction = activeTransaction {
    switch transaction.ownershipType {
    case .purchased:
        // Direct subscriber
        break
    case .familyShared:
        // Has access through family sharing
        break
    default:
        break
    }
}
```

**Recommendation:** For our simple app, you can start without Family Sharing. It's a nice-to-have for a future update.

### Handling Refunds

When Apple issues a refund:
1. You receive a `REFUND` server notification
2. `Transaction.revocationDate` is set on the transaction
3. `Transaction.currentEntitlements` no longer includes the refunded transaction

```swift
// In your entitlement check, revocationDate filters out refunded transactions
if transaction.revocationDate != nil {
    // This transaction was refunded, do not grant access
    continue
}
```

On the server side, mark the subscription as `revoked` when you receive the `REFUND` notification.

Apple may also send a `CONSUMPTION_REQUEST` asking for info to help decide a refund. You can respond with the user's usage data via the App Store Server API.

### What Happens When Subscription Expires Mid-Session

If a user is actively using the app when their subscription expires:

- **StoreKit 2 approach:** `Transaction.updates` fires, your listener updates `isProSubscriber`
- **Practical approach for our app:** Don't interrupt an active scan. Check subscription status when the user initiates a new scan, not during one.

```swift
// Check entitlement at scan initiation, not continuously
func startScan() async throws {
    // Refresh status before scan
    await storeManager.updateSubscriptionStatus()

    guard storeManager.isProSubscriber || usageManager.canScan else {
        throw AppError.scanLimitReached
    }

    // Proceed with scan...
}
```

---

## Summary: Implementation Order

1. **Set up StoreKit Configuration File** for local testing
2. **Build StoreManager** with product loading, purchase, and entitlement checking
3. **Build PaywallView** using `SubscriptionStoreView` for minimum code
4. **Add `appAccountToken`** to purchases linking to Supabase user ID
5. **Create Supabase tables** (`subscriptions`, `scan_usage`)
6. **Build webhook Edge Function** to receive App Store Server Notifications V2
7. **Gate the scan API** based on subscription status + free tier usage
8. **Configure App Store Connect** with real products and webhook URLs
9. **Test end-to-end** in sandbox, then TestFlight
10. **Submit for review** with subscription metadata and screenshot of paywall
