# PRD: AI-Powered Grocery Categorization

**Status:** Draft
**Created:** 2026-02-07

## Problem Statement

The current keyword-matching system for assigning grocery items to store sections has low coverage. With only ~130 hardcoded keywords, many items fall into the "Other" catch-all section, undermining the app's core value of organizing a shopping list by store aisle. Users end up mentally re-sorting at the store, which defeats the purpose.

The system also can't handle context -- "frozen strawberries" and "strawberries" should go to different sections, but substring matching can't distinguish them. And the architecture is a dead end: adding multi-store support later would require maintaining separate keyword lists per store, which doesn't scale.

## Target Users

The app's primary user: someone who writes grocery lists by hand, photographs them, and wants an organized digital checklist grouped by store aisle. They shouldn't need to think about how categorization works -- items should just appear in the right section.

## Current Alternatives

A hardcoded `STORE_SECTIONS` map in `store-sections.ts` with ~130 keywords matched via `string.includes()`. First keyword match wins. Items with no match go to "Other." Adding coverage requires editing source code and redeploying.

Problems with this approach:
- Low coverage leads to a large "Other" section
- Substring matching causes false positives (e.g., "rice" matching "ice")
- Context-insensitive (can't distinguish "frozen strawberries" from "strawberries")
- Every new item type requires a code change

## Proposed Solution

Replace keyword-matching with Claude-based categorization in the existing API call. The app already sends the grocery list image to Claude for transcription -- extend that same call to also categorize each item by store section.

### Core Changes

**1. Extend the existing API call**

Modify the tool schema in `anthropic-client.ts` so each item includes a `category` field alongside its name. Update the prompt to include the list of known store sections and instruct Claude to:
- Assign each item to the most appropriate known section
- Propose a new section name if an item clearly doesn't fit any existing one
- Use context from the item name to make decisions (e.g., "frozen strawberries" -> Frozen Foods, "strawberries" -> Produce)

The `category` field should be a free string (not an enum) so Claude can propose new sections.

**2. Adaptive section list**

Maintain the current predefined sections (Produce, Bakery, Meat & Seafood, etc.) as defaults. When Claude proposes a new section:
- Display it in the list with a dynamically assigned color
- Persist it to localStorage so it appears as a known section in future API calls
- The section list grows organically based on actual shopping patterns

Storage: a `custom_sections` key in localStorage containing an array of user-accumulated section names.

**3. Remove keyword matching**

Delete `categorizeItem()` and the `STORE_SECTIONS` keyword map. Keep `SECTION_ORDER` and `SECTION_COLORS` for display of predefined sections. Add a fallback color system for dynamically created sections.

**4. Update data flow**

Current: Image -> Claude (transcribe) -> User selects sections -> `categorizeItem()` (local) -> List
New: Image -> Claude (transcribe + categorize) -> User selects sections -> List

The `GroceryItem` type gains its category from the API response rather than local computation.

### Multi-Store (Future, Not In Scope)

The data model should be designed so adding a `store` field to `GroceryItem` later is straightforward. The current work removes the main blocker (hardcoded categorization) and establishes the AI-driven pattern that multi-store will build on. UI for multi-store display (tabs, grouping, filtering) needs separate design work.

## Success Criteria

- **Zero maintenance:** No code changes required when users write new/unusual items on their lists. The keyword list in source code is gone.
- **Reduced "Other" usage:** The majority of items should be categorized into a named section. "Other" becomes a rare edge case rather than a common bucket.
- **Context-aware placement:** Items like "frozen chicken" go to Frozen Foods, not Meat & Seafood. "Almond milk" goes to Dairy & Eggs, not Snacks.
- **No added latency:** Categorization happens in the existing API call, not a separate round-trip.

## Non-Goals

- **Store-specific pricing or availability** -- No checking if items are available or cheaper at a given store
- **Multi-store item assignment** -- Items won't be tagged with which store to buy them at (future work)
- **Separate list views per store** -- No tabs or filtered views by store (future work, needs design)

## Open Questions

1. **Fallback when API fails:** If the API call succeeds at transcription but returns items without categories, should we fall back to keyword matching or just put everything in "Other"? (Leaning toward keeping a lightweight version of keyword matching as fallback.)
2. **Section merging:** If Claude proposes "Personal Care" one time and "Health & Beauty" another, should the app treat these as the same section? How fuzzy should matching be?
3. **Removing learned sections:** If a custom section was proposed once and never appears again, should it eventually be pruned from the known list? Or does it persist forever?
4. **Clarify screen impact:** The clarify screen currently shows sections from the handwritten list (grocery, meal_plan, crossed_out). After this change, items within selected sections will already have store-aisle categories. Does this change the clarify screen's role or UI at all?
