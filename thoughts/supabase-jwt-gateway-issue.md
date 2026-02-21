# Supabase Edge Function Gateway JWT Rejection

## Problem

When calling the `analyze-grocery-list` edge function from the iOS app via the Supabase Swift SDK's `functions.invoke()`, the Supabase API gateway returned:

```json
{"code": 401, "message": "Invalid JWT"}
```

This error came from the gateway layer (before our function code ran), not from our function's own auth logic. The JWT was a valid Supabase session token obtained via Sign in with Apple + `signInWithIdToken()`.

## What We Tried

1. **Raw URLSession with manual headers** (`Authorization: Bearer <jwt>`, `apikey: <anon_key>`, `Content-Type: application/json`) -- same 401
2. **Supabase Swift SDK `functions.invoke()`** (SDK handles headers automatically) -- same 401
3. **Deployed with `--no-verify-jwt`** -- works. Function's own `getUser()` call validates auth successfully.

## Resolution

Deployed the edge function with `supabase functions deploy analyze-grocery-list --no-verify-jwt`. The function still enforces auth via `supabase.auth.getUser()` inside the function body. Security is equivalent -- unauthenticated requests are rejected by the function instead of by the gateway.

## Hypotheses for Root Cause

### 1. New API key format incompatibility (most likely)

The project uses the new Supabase API key format (`sb_publishable_*`) rather than the legacy JWT-based format (`eyJ...`). The gateway's JWT verification may not fully support this newer key format. The gateway might be using the old anon key as part of its JWT secret derivation, and the new format breaks that assumption.

### 2. JWT signing algorithm mismatch

The session token's header showed `alg: ES256` (asymmetric, used by newer Supabase projects). The gateway verification may still expect `HS256` (symmetric, used by legacy projects). If the project was created with asymmetric keys, the gateway's verification layer might not have been updated to handle ES256 tokens.

### 3. Gateway configuration lag

Newly created Supabase projects (this one was created 2026-02-20) might have a delay before the gateway's JWT verification config is fully propagated. The `--no-verify-jwt` flag bypasses this entirely.

### 4. SDK version mismatch

The Supabase Swift SDK (`supabase-swift >= 2.0.0`) may construct the authorization headers differently than what the gateway expects. The SDK auto-propagates the auth token via `functions.setAuth(token:)` on auth state changes, but the gateway might expect additional headers or a different token format.

## Impact Assessment

- **Security**: No degradation. `getUser()` in the function body validates the JWT against Supabase's auth server. Invalid/expired tokens are rejected.
- **Performance**: Negligible. Invalid requests cause the function to cold-start before rejecting, rather than being rejected at the gateway. For a single-user mobile app, this is irrelevant.
- **Maintenance**: If Supabase fixes the gateway compatibility, we could re-deploy without `--no-verify-jwt`. No code changes needed.

## How to Re-test Later

```bash
# Re-deploy WITH gateway verification
supabase functions deploy analyze-grocery-list

# If it works, the gateway issue was fixed
# If 401 returns, re-deploy without
supabase functions deploy analyze-grocery-list --no-verify-jwt
```

## References

- Supabase Edge Functions JWT docs: https://supabase.com/docs/guides/functions/auth
- `--no-verify-jwt` flag: https://supabase.com/docs/reference/cli/supabase-functions-deploy
- New API key format: visible in project dashboard under Settings > API
- Supabase Swift SDK auth propagation: `SupabaseClient.swift:392` calls `functions.setAuth(token:)` on auth state change

## Date

2026-02-20
