# Subscription & Backend Research

Research into the backend infrastructure needed to support a subscription-based native iOS app that proxies Anthropic API calls.

> **Note:** The app is being rewritten as a native SwiftUI iOS app. There is no web version to maintain. Payments are handled exclusively through Apple In-App Purchases. This document focuses on auth, backend proxy, and API cost analysis.

---

## 1. Authentication

### Sign in with Apple (Primary)

Since this is an iOS-only app, Sign in with Apple is the natural primary auth method. Apple requires apps that offer third-party sign-in to also offer Sign in with Apple.

**What it provides:**
- One-tap sign-in with Face ID / Touch ID
- Email relay (users can hide their real email)
- No password to manage
- Trusted by iOS users

### Supabase Auth (Backend)

Supabase Auth handles the server-side of authentication. The `supabase-swift` SDK supports Sign in with Apple natively -- the Apple ID token is exchanged for a Supabase JWT.

**Pricing:**

| Tier | Monthly Cost | MAU Limit | Key Limits |
|------|-------------|-----------|------------|
| Free | $0 | 50,000 | 500MB DB, 500K edge function invocations, 1GB storage |
| Pro | $25/mo | 100,000 | 8GB DB, 2M edge function invocations, 100GB storage |

**Why Supabase (not just Sign in with Apple alone):**
- We need a backend database for subscription status, usage tracking
- We need edge functions to proxy Anthropic API calls
- Supabase bundles auth + database + functions in one platform
- The Swift SDK (`supabase-swift`) is well-maintained and supports auth, database, and edge function invocation
- JWTs from Supabase Auth are automatically validated by edge functions

**Additional auth methods (optional, all included free):**
- Email/password (for users who prefer it)
- Google OAuth
- Magic link

### Alternatives Considered

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Firebase Auth** | Unlimited for most methods | Locks into Google ecosystem. Would need separate backend for edge functions. |
| **CloudKit + Sign in with Apple** | Free with Apple Developer account | Apple-native, but no edge functions. Would need a separate backend (e.g., Cloudflare Workers) for API proxying. More vendor sprawl. |
| **Auth0** | 25,000 MAU | Overkill and expensive for a small app. |

**Verdict:** Supabase is the best fit. It bundles everything we need (auth, database, edge functions) and has a solid Swift SDK.

---

## 2. Backend for API Proxying

The Anthropic API key cannot be embedded in the iOS app binary -- it must live on a server. We need a lightweight backend that:
- Receives image data from the authenticated iOS client
- Validates the user's JWT and subscription status
- Forwards the request to the Anthropic API with our server-side key
- Returns the structured result to the client

### Options Compared

| Feature | Supabase Edge Functions | Cloudflare Workers | AWS Lambda |
|---------|----------------------|-------------------|------------|
| **Runtime** | Deno | V8 isolates (JS/Wasm) | Node.js, Python, etc. |
| **Free tier** | 500K invocations/mo | 100K requests/day | 1M requests, 400K GB-sec/mo |
| **Paid pricing** | Included in $25/mo Pro | $5/mo + $0.30/M requests | ~$0.20/M requests |
| **Cold starts** | Minimal (edge) | Near-zero | Moderate to high |
| **Max execution time** | 150s (Free), 400s (Pro) | 30s default, 5min max | 15 min max |
| **Request size limit** | 6MB | 100MB | 6MB (sync) |
| **Auth integration** | Built-in Supabase Auth JWT validation | Manual JWT validation | Manual JWT validation |

### Recommendation

**Supabase Edge Functions** -- same reasons as before but even stronger for iOS-only:

- Already using Supabase for auth -- zero additional vendor
- Native JWT validation (automatic)
- `supabase-swift` SDK makes calling edge functions trivial from Swift:

```swift
let response = try await supabase.functions.invoke(
    "analyze-grocery-list",
    options: .init(body: ["imageBase64": imageData, "mediaType": "image/jpeg"])
)
```

- 500K free invocations/month is plenty for launch
- 6MB request limit handles phone photos comfortably

### Architecture

```
iOS App (SwiftUI)
  |
  | supabase.functions.invoke("analyze-grocery-list")
  | Authorization: Bearer <supabase_jwt> (automatic)
  | Body: { imageBase64, mediaType }
  |
  v
Supabase Edge Function (Deno/TypeScript)
  |
  | 1. Validate JWT (automatic)
  | 2. Check subscription status (query profiles table)
  | 3. Call Anthropic API with server-side key
  |    - Sonnet 4.5 for image analysis
  |    - Haiku 4.5 for category sanity check
  | 4. Return structured grocery sections
  |
  v
iOS App receives GrocerySections -> display
```

### Edge Functions Needed

| Function | Trigger | Purpose |
|----------|---------|---------|
| `analyze-grocery-list` | Client call | Proxy image analysis + sanity check to Anthropic API |
| `apple-webhook` | Apple Server Notification v2 | Sync subscription status changes to database |

---

## 3. Database Schema

```sql
-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  apple_subscription_status text default 'none',  -- 'none', 'active', 'expired', 'grace_period'
  apple_original_transaction_id text,              -- for subscription tracking
  scan_count_this_month integer default 0,
  scan_count_reset_at timestamptz,                 -- when to reset monthly counter
  created_at timestamptz default now()
);

-- Usage tracking
create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  input_tokens integer,
  output_tokens integer,
  cost_estimate numeric(10,6)
);

-- Row Level Security
alter table profiles enable row level security;
alter table scans enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can read own scans"
  on scans for select using (auth.uid() = user_id);
```

---

## 4. Anthropic API Cost Analysis

### Two API Calls Per List Scan

**Call 1: Image Analysis** (Claude Sonnet 4.5)
- Model: `claude-sonnet-4-5-20250929`
- Input: ~2,000 tokens (prompt + tool definition + image)
- Output: ~500 tokens (structured JSON with sections/items)

**Call 2: Category Sanity Check** (Claude Haiku 4.5)
- Model: `claude-haiku-4-5-20251001`
- Input: ~800 tokens (prompt + tool definition + item list)
- Output: ~400 tokens (corrected categorizations)

### Cost Per Scan

| Call | Model | Input Cost | Output Cost | Total |
|------|-------|-----------|-------------|-------|
| Image Analysis | Sonnet 4.5 ($3/$15 per MTok) | $0.006 | $0.0075 | **$0.0135** |
| Sanity Check | Haiku 4.5 ($1/$5 per MTok) | $0.0008 | $0.002 | **$0.0028** |
| **Total per scan** | | | | **~$0.016** |

**1.6 cents per grocery list scan.**

### Monthly API Costs by Usage

| Scans/Month | API Cost |
|-------------|----------|
| 5 | $0.08 |
| 10 | $0.16 |
| 20 | $0.32 |
| 50 | $0.80 |
| 100 | $1.60 |

API costs are negligible relative to subscription revenue.

### Model Optimization

Could switch image analysis to Haiku 4.5 to cut costs to ~$0.005/scan. Worth testing -- if accuracy is acceptable for typical handwritten lists, this is a 3x cost reduction.

---

## 5. Subscription Design

### Tiers

| Tier | Price | Scans | Notes |
|------|-------|-------|-------|
| **Free** | $0 (sign up required) | 3/month | Try before you buy. API cost: ~$0.05/month. |
| **Pro (monthly)** | $4.99/month | Unlimited | Primary offering |
| **Pro (annual)** | $39.99/year | Unlimited | ~33% savings, better retention |

### Revenue Per Subscriber (Apple IAP with Small Business Program, 15%)

| Plan | Price | Apple Commission | Developer Keeps |
|------|-------|-----------------|-----------------|
| Monthly | $4.99 | $0.75 | $4.24 |
| Annual | $39.99/year | $6.00/year | $33.99/year ($2.83/month) |

### Break-Even

Fixed monthly costs at Pro tier: ~$33/month (Supabase Pro $25 + Apple Developer $8.25)

- Monthly plan: $4.24/subscriber -> break-even at **8 subscribers**
- Annual plan: $2.83/subscriber/month -> break-even at **12 subscribers**

---

## Summary

| Decision | Recommendation | Cost |
|----------|---------------|------|
| Auth | Sign in with Apple + Supabase Auth | $0 (free tier) to $25/mo (Pro) |
| Payments | Apple In-App Purchases (Small Business Program) | 15% commission |
| Backend/Proxy | Supabase Edge Functions | Included with Supabase plan |
| AI Model | Sonnet 4.5 (analysis) + Haiku 4.5 (sanity check) | ~$0.016 per scan |
| **Total fixed costs** | | **$8-33/month** |
| **Break-even** | At $4.99/month subscription | **~8 subscribers** |
