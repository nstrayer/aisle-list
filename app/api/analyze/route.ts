import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { grocerySectionSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { imageBase64, mediaType, apiKey } = await req.json();

  if (!apiKey) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  if (!imageBase64 || !mediaType) {
    return Response.json(
      { error: "Image data and media type are required" },
      { status: 400 }
    );
  }

  try {
    const anthropic = createAnthropic({ apiKey });

    const result = await generateObject({
      model: anthropic("claude-sonnet-4-5-20250929"),
      schema: grocerySectionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: `data:${mediaType};base64,${imageBase64}`,
            },
            {
              type: "text",
              text: `Analyze this handwritten list. Identify distinct sections:
- Items under store names (Kroger, Costco, Target, etc.) - use the store name as section name
- Meal plans (days of week with dishes) - type "meal_plan"
- Crossed-out items - type "crossed_out"
- General grocery items - type "grocery"
- Notes or other text - type "notes"

Group items by section. For unlabeled grocery items, use "Grocery list" as the section name with type "grocery".
Each item should be a clean item name (remove bullets, dashes, etc.).`,
            },
          ],
        },
      ],
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Error analyzing image:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze image";
    return Response.json({ error: message }, { status: 500 });
  }
}
