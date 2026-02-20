import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const FREE_SCAN_LIMIT = 3;

const ANALYZE_PROMPT = `Analyze this handwritten list. Identify distinct sections:
- Items under store names (Kroger, Costco, Target, etc.) - use the store name as section name
- Meal plans (days of week with dishes) - type "meal_plan"
- Crossed-out items - type "crossed_out"
- General grocery items - type "grocery"
- Notes or other text - type "notes"

Group items by section. For unlabeled grocery items, use "Grocery list" as the section name with type "grocery".
Each item should be a clean item name (remove bullets, dashes, etc.).
Correct obvious spelling mistakes in item names (e.g., "bannana" -> "banana", "brocoli" -> "broccoli").`;

const GROCERY_SECTIONS_TOOL = {
  name: "grocery_sections",
  description: "Return the identified grocery sections from the image",
  input_schema: {
    type: "object",
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Descriptive name for this section",
            },
            type: {
              type: "string",
              enum: ["grocery", "meal_plan", "crossed_out", "notes"],
              description: "Type of section",
            },
            items: {
              type: "array",
              items: { type: "string" },
              description: "Items in this section",
            },
          },
          required: ["name", "type", "items"],
        },
      },
    },
    required: ["sections"],
  },
};

const CATEGORIZED_ITEMS_TOOL = {
  name: "categorized_items",
  description:
    "Return the corrected category assignments for grocery items",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The item id (must match the input exactly)",
            },
            name: {
              type: "string",
              description:
                "The grocery item name (must match the input exactly)",
            },
            category: {
              type: "string",
              description:
                "The correct store section for this item. Use one of the standard sections when possible, or propose a new short Title Case section name when none fit well.",
            },
          },
          required: ["id", "name", "category"],
        },
      },
    },
    required: ["items"],
  },
};

const STORE_SECTIONS = [
  "Produce",
  "Bakery",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Frozen Foods",
  "Pantry & Canned Goods",
  "International",
  "Condiments & Sauces",
  "Snacks",
  "Beverages",
  "Household & Cleaning",
  "Other",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function buildSanityCheckPrompt(
  items: { id: string; name: string; category: string }[]
): string {
  const sections = STORE_SECTIONS.join(", ");
  const itemList = items
    .map((i) => `- [${i.id}] "${i.name}" -> ${i.category}`)
    .join("\n");

  return `You are a grocery store categorization expert. Review the following grocery items and their assigned store sections. Fix any miscategorizations and assign better categories to items marked "Other".

Preferred store sections: ${sections}

If an item does not fit well into any of the above sections, you may propose a new short, Title Case section name (e.g., "Baby Products", "Pet Supplies", "Health & Beauty"). Only create a new section when the standard ones are a genuinely poor fit.

Items to review:
${itemList}`;
}

interface AnalyzePayload {
  action: "analyze";
  imageBase64: string;
  mediaType: string;
}

interface SanityCheckPayload {
  action: "sanity_check";
  items: { id: string; name: string; category: string }[];
}

type RequestPayload = AnalyzePayload | SanityCheckPayload;

function validatePayload(body: unknown): RequestPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;

  if (obj.action === "analyze") {
    if (
      typeof obj.imageBase64 !== "string" ||
      !obj.imageBase64 ||
      typeof obj.mediaType !== "string" ||
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        obj.mediaType
      )
    ) {
      return null;
    }
    return obj as unknown as AnalyzePayload;
  }

  if (obj.action === "sanity_check") {
    if (!Array.isArray(obj.items) || obj.items.length === 0) return null;
    return obj as unknown as SanityCheckPayload;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Validate auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  // Validate payload
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const payload = validatePayload(rawBody);
  if (!payload) {
    return jsonResponse(
      { error: "Invalid request. Required: action (analyze|sanity_check) with appropriate fields." },
      400
    );
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  // For analyze action: check usage limits (before calling Anthropic)
  if (payload.action === "analyze") {
    const canScan = await checkScanLimit(supabase, user.id);
    if (!canScan) {
      return jsonResponse(
        {
          error: "scan_limit_reached",
          scansUsed: FREE_SCAN_LIMIT,
          scanLimit: FREE_SCAN_LIMIT,
          upgradeRequired: true,
        },
        403
      );
    }
  }

  // Call Anthropic API
  try {
    const anthropicBody = buildAnthropicRequest(payload);
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", await anthropicRes.text());
      return jsonResponse({ error: "AI analysis failed" }, 502);
    }

    const anthropicData = await anthropicRes.json();
    const toolUse = anthropicData.content?.find(
      (block: { type: string }) => block.type === "tool_use"
    );

    if (!toolUse) {
      return jsonResponse({ error: "AI analysis failed" }, 502);
    }

    // Record scan usage only after successful analysis
    if (payload.action === "analyze") {
      const { error: insertError } = await supabase
        .from("scan_usage")
        .insert({ user_id: user.id });
      if (insertError) {
        console.error("Failed to record scan usage:", insertError);
      }
    }

    return jsonResponse(toolUse.input);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse({ error: "AI analysis failed" }, 502);
  }
});

async function checkScanLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  // Check for active subscription first
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "grace_period"])
    .limit(1)
    .single();

  if (sub) return true;

  // Count scans this calendar month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await supabase
    .from("scan_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  return (count ?? 0) < FREE_SCAN_LIMIT;
}

function buildAnthropicRequest(payload: RequestPayload) {
  if (payload.action === "analyze") {
    return {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      tools: [GROCERY_SECTIONS_TOOL],
      tool_choice: { type: "tool", name: "grocery_sections" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: payload.mediaType,
                data: payload.imageBase64,
              },
            },
            { type: "text", text: ANALYZE_PROMPT },
          ],
        },
      ],
    };
  }

  // sanity_check
  const prompt = buildSanityCheckPrompt(payload.items);
  return {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [CATEGORIZED_ITEMS_TOOL],
    tool_choice: { type: "tool", name: "categorized_items" },
    messages: [{ role: "user", content: prompt }],
  };
}
