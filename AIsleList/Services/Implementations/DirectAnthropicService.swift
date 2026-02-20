import Foundation

struct DirectAnthropicService: GroceryAnalysisService {

    let apiKey: String

    private static let apiURL = URL(string: "https://api.anthropic.com/v1/messages")!
    private static let apiVersion = "2023-06-01"
    private static let analyzeModel = "claude-sonnet-4-5-20250929"
    private static let sanityCheckModel = "claude-haiku-4-5-20251001"

    // MARK: - Prompts (ported from anthropic-client.ts)

    private static let analyzePrompt = """
        Analyze this handwritten list. Identify distinct sections:
        - Items under store names (Kroger, Costco, Target, etc.) - use the store name as section name
        - Meal plans (days of week with dishes) - type "meal_plan"
        - Crossed-out items - type "crossed_out"
        - General grocery items - type "grocery"
        - Notes or other text - type "notes"

        Group items by section. For unlabeled grocery items, use "Grocery list" as the section name with type "grocery".
        Each item should be a clean item name (remove bullets, dashes, etc.).
        Correct obvious spelling mistakes in item names (e.g., "bannana" -> "banana", "brocoli" -> "broccoli").
        """

    private static let sanityCheckPromptPrefix = """
        You are a grocery store categorization expert. Review the following grocery items and their assigned store sections. Fix any miscategorizations and assign better categories to items marked "Other".

        Preferred store sections: \(StoreSections.sectionOrder.joined(separator: ", "))

        If an item does not fit well into any of the above sections, you may propose a new short, Title Case section name (e.g., "Baby Products", "Pet Supplies", "Health & Beauty"). Only create a new section when the standard ones are a genuinely poor fit.

        Items to review:

        """

    // MARK: - Tool Definitions

    private static let analyzeTool: [String: Any] = [
        "name": "grocery_sections",
        "description": "Return the identified grocery sections from the image",
        "input_schema": [
            "type": "object",
            "properties": [
                "sections": [
                    "type": "array",
                    "items": [
                        "type": "object",
                        "properties": [
                            "name": ["type": "string", "description": "Descriptive name for this section"],
                            "type": ["type": "string", "enum": ["grocery", "meal_plan", "crossed_out", "notes"], "description": "Type of section"],
                            "items": ["type": "array", "items": ["type": "string"], "description": "Items in this section"],
                        ],
                        "required": ["name", "type", "items"],
                    ] as [String: Any],
                ] as [String: Any],
            ] as [String: Any],
            "required": ["sections"],
        ] as [String: Any],
    ]

    private static let sanityCheckTool: [String: Any] = [
        "name": "categorized_items",
        "description": "Return the corrected category assignments for grocery items",
        "input_schema": [
            "type": "object",
            "properties": [
                "items": [
                    "type": "array",
                    "items": [
                        "type": "object",
                        "properties": [
                            "id": ["type": "string", "description": "The item id (must match the input exactly)"],
                            "name": ["type": "string", "description": "The grocery item name (must match the input exactly)"],
                            "category": ["type": "string", "description": "The correct store section for this item. Use one of the standard sections when possible, or propose a new short Title Case section name when none fit well."],
                        ],
                        "required": ["id", "name", "category"],
                    ] as [String: Any],
                ] as [String: Any],
            ] as [String: Any],
            "required": ["items"],
        ] as [String: Any],
    ]

    // MARK: - GroceryAnalysisService

    func analyzeImage(base64: String, mediaType: String) async throws -> [GrocerySection] {
        let body: [String: Any] = [
            "model": Self.analyzeModel,
            "max_tokens": 4096,
            "tools": [Self.analyzeTool],
            "tool_choice": ["type": "tool", "name": "grocery_sections"],
            "messages": [
                [
                    "role": "user",
                    "content": [
                        [
                            "type": "image",
                            "source": [
                                "type": "base64",
                                "media_type": mediaType,
                                "data": base64,
                            ],
                        ],
                        [
                            "type": "text",
                            "text": Self.analyzePrompt,
                        ],
                    ],
                ],
            ],
        ]

        let responseData = try await sendRequest(body: body)
        let toolInput = try extractToolInput(from: responseData)

        guard let sectionsJSON = toolInput["sections"] as? [[String: Any]] else {
            throw ServiceError.invalidResponse("Missing sections in tool response")
        }

        let jsonData = try JSONSerialization.data(withJSONObject: sectionsJSON)
        return try JSONDecoder().decode([GrocerySection].self, from: jsonData)
    }

    func sanityCheckCategories(items: [(id: String, name: String, category: String)]) async throws -> [(id: String, name: String, category: String)] {
        let itemList = items
            .map { "- [\($0.id)] \"\($0.name)\" -> \($0.category)" }
            .joined(separator: "\n")
        let fullPrompt = Self.sanityCheckPromptPrefix + itemList

        let body: [String: Any] = [
            "model": Self.sanityCheckModel,
            "max_tokens": 2048,
            "tools": [Self.sanityCheckTool],
            "tool_choice": ["type": "tool", "name": "categorized_items"],
            "messages": [
                [
                    "role": "user",
                    "content": fullPrompt,
                ],
            ],
        ]

        let responseData = try await sendRequest(body: body)
        let toolInput = try extractToolInput(from: responseData)

        guard let itemsJSON = toolInput["items"] as? [[String: Any]] else {
            throw ServiceError.invalidResponse("Missing items in tool response")
        }

        return itemsJSON.compactMap { dict -> (id: String, name: String, category: String)? in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let category = dict["category"] as? String else { return nil }
            return (id: id, name: name, category: category)
        }
    }

    // MARK: - Private Helpers

    private func sendRequest(body: [String: Any]) async throws -> Data {
        var request = URLRequest(url: Self.apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue(Self.apiVersion, forHTTPHeaderField: "anthropic-version")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ServiceError.networkError("Invalid response type")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw ServiceError.apiError(statusCode: httpResponse.statusCode, message: message)
        }

        return data
    }

    private func extractToolInput(from data: Data) throws -> [String: Any] {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = json["content"] as? [[String: Any]] else {
            throw ServiceError.invalidResponse("Could not parse API response")
        }

        guard let toolUse = content.first(where: { ($0["type"] as? String) == "tool_use" }),
              let input = toolUse["input"] as? [String: Any] else {
            throw ServiceError.invalidResponse("No tool response received from Claude")
        }

        return input
    }
}

// MARK: - Errors

enum ServiceError: LocalizedError {
    case networkError(String)
    case apiError(statusCode: Int, message: String)
    case invalidResponse(String)

    var errorDescription: String? {
        switch self {
        case .networkError(let msg): return "Network error: \(msg)"
        case .apiError(let code, let msg): return "API error (\(code)): \(msg)"
        case .invalidResponse(let msg): return "Invalid response: \(msg)"
        }
    }
}
