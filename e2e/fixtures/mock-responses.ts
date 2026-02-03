import type { GrocerySection } from "../../src/lib/types";

// Mock sections that cover all 4 types
export const mockSections: GrocerySection[] = [
  {
    name: "Grocery list",
    type: "grocery",
    items: ["milk", "eggs", "bread", "butter", "cheese"],
  },
  {
    name: "Costco",
    type: "grocery",
    items: ["paper towels", "olive oil", "almonds"],
  },
  {
    name: "Meal Plan",
    type: "meal_plan",
    items: ["Monday: Tacos", "Tuesday: Pasta", "Wednesday: Stir fry"],
  },
  {
    name: "Already have",
    type: "crossed_out",
    items: ["rice", "flour"],
  },
  {
    name: "Notes",
    type: "notes",
    items: ["Check coupon app", "Birthday cake for Saturday"],
  },
];

// Mock Anthropic API response matching the tool_use format
export function createMockApiResponse(sections: GrocerySection[] = mockSections) {
  return {
    id: "msg_mock_123",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_mock_456",
        name: "grocery_sections",
        input: {
          sections,
        },
      },
    ],
    model: "claude-sonnet-4-5-20250929",
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: {
      input_tokens: 1000,
      output_tokens: 200,
    },
  };
}
