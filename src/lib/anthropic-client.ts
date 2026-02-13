import Anthropic from "@anthropic-ai/sdk";
import type { GrocerySection } from "./types";
import { SECTION_ORDER } from "./store-sections";

const ANALYZE_PROMPT = `Analyze this handwritten list. Identify distinct sections:
- Items under store names (Kroger, Costco, Target, etc.) - use the store name as section name
- Meal plans (days of week with dishes) - type "meal_plan"
- Crossed-out items - type "crossed_out"
- General grocery items - type "grocery"
- Notes or other text - type "notes"

Group items by section. For unlabeled grocery items, use "Grocery list" as the section name with type "grocery".
Each item should be a clean item name (remove bullets, dashes, etc.).
Correct obvious spelling mistakes in item names (e.g., "bannana" -> "banana", "brocoli" -> "broccoli").`;

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "grocery_sections",
  description: "Return the identified grocery sections from the image",
  input_schema: {
    type: "object" as const,
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

interface ToolInput {
  sections: GrocerySection[];
}

export async function analyzeGroceryImage(
  imageBase64: string,
  mediaType: string,
  apiKey: string
): Promise<GrocerySection[]> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "grocery_sections" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: ANALYZE_PROMPT,
          },
        ],
      },
    ],
  });

  // Extract tool use result
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No tool response received from Claude");
  }

  const input = toolUse.input as ToolInput;
  return input.sections;
}

const SANITY_CHECK_PROMPT = `You are a grocery store categorization expert. Review the following grocery items and their assigned store sections. Fix any miscategorizations and assign better categories to items marked "Other".

Valid store sections: ${SECTION_ORDER.join(", ")}

Items to review:
`;

const SANITY_CHECK_TOOL: Anthropic.Tool = {
  name: "categorized_items",
  description: "Return the corrected category assignments for grocery items",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The grocery item name (must match the input exactly)",
            },
            category: {
              type: "string",
              enum: SECTION_ORDER,
              description: "The correct store section for this item",
            },
          },
          required: ["name", "category"],
        },
      },
    },
    required: ["items"],
  },
};

interface SanityCheckInput {
  items: Array<{ name: string; category: string }>;
}

export async function sanityCheckCategories(
  items: Array<{ name: string; category: string }>,
  apiKey: string
): Promise<Array<{ name: string; category: string }>> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const itemList = items
    .map((item) => `- "${item.name}" -> ${item.category}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20250929",
    max_tokens: 2048,
    tools: [SANITY_CHECK_TOOL],
    tool_choice: { type: "tool", name: "categorized_items" },
    messages: [
      {
        role: "user",
        content: SANITY_CHECK_PROMPT + itemList,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No tool response received from Claude");
  }

  const input = toolUse.input as SanityCheckInput;
  return input.items;
}
