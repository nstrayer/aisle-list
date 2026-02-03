import Anthropic from "@anthropic-ai/sdk";
import type { GrocerySection } from "./types";

const ANALYZE_PROMPT = `Analyze this handwritten list. Identify distinct sections:
- Items under store names (Kroger, Costco, Target, etc.) - use the store name as section name
- Meal plans (days of week with dishes) - type "meal_plan"
- Crossed-out items - type "crossed_out"
- General grocery items - type "grocery"
- Notes or other text - type "notes"

Group items by section. For unlabeled grocery items, use "Grocery list" as the section name with type "grocery".
Each item should be a clean item name (remove bullets, dashes, etc.).`;

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

async function callAnthropicDirect(
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

async function callAnthropicViaBackend(
  imageBase64: string,
  mediaType: string,
  apiKey: string
): Promise<GrocerySection[]> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mediaType, apiKey }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to analyze image");
  }

  return data.sections;
}

function isCorsError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return true;
  }
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("cors")
  ) {
    return true;
  }
  return false;
}

export async function analyzeGroceryImage(
  imageBase64: string,
  mediaType: string,
  apiKey: string
): Promise<GrocerySection[]> {
  try {
    // Try direct browser request first
    return await callAnthropicDirect(imageBase64, mediaType, apiKey);
  } catch (error) {
    // If CORS error, fall back to backend proxy
    if (isCorsError(error)) {
      console.log("CORS blocked, falling back to backend proxy");
      return await callAnthropicViaBackend(imageBase64, mediaType, apiKey);
    }
    // Re-throw other errors
    throw error;
  }
}
