import Foundation

// MARK: - Errors

enum AnalysisError: LocalizedError {
    case noToolResponse
    case apiError(String)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .noToolResponse:
            return "No tool response received from Claude"
        case .apiError(let message):
            return "API error: \(message)"
        case .decodingError:
            return "Failed to decode API response"
        }
    }
}

// MARK: - DirectAnthropicService

final class DirectAnthropicService: GroceryAnalysisService {

    private let apiKey: String
    private let baseURL = URL(string: "https://api.anthropic.com/v1/messages")!

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    // MARK: - analyzeImage

    func analyzeImage(_ imageBase64: String, mediaType: String) async throws -> [GrocerySection] {
        let body: [String: Any] = [
            "model": "claude-sonnet-4-5-20250929",
            "max_tokens": 4096,
            "tools": [grocerySectionsTool],
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
                                "data": imageBase64,
                            ] as [String: Any],
                        ] as [String: Any],
                        [
                            "type": "text",
                            "text": analyzePrompt,
                        ] as [String: Any],
                    ],
                ] as [String: Any]
            ],
        ]

        let data = try await performRequest(body: body)
        let toolInput = try extractToolInput(from: data)

        guard let sectionsArray = toolInput["sections"] as? [[String: Any]] else {
            throw AnalysisError.decodingError
        }

        let sectionsData = try JSONSerialization.data(withJSONObject: sectionsArray)
        let rawSections = try JSONDecoder().decode([RawSection].self, from: sectionsData)

        return rawSections.map { raw in
            GrocerySection(
                name: raw.name,
                type: GrocerySection.SectionType(rawValue: raw.type) ?? .grocery,
                items: raw.items
            )
        }
    }

    // MARK: - sanityCheckCategories

    func sanityCheckCategories(_ items: [ItemCategoryPair]) async throws -> [ItemCategoryPair] {
        let itemList = items
            .map { "- [\($0.id)] \"\($0.name)\" -> \($0.category)" }
            .joined(separator: "\n")

        let fullPrompt = sanityCheckPrompt + itemList

        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 2048,
            "tools": [categorizedItemsTool],
            "tool_choice": ["type": "tool", "name": "categorized_items"],
            "messages": [
                [
                    "role": "user",
                    "content": fullPrompt,
                ] as [String: Any]
            ],
        ]

        let data = try await performRequest(body: body)
        let toolInput = try extractToolInput(from: data)

        guard let itemsArray = toolInput["items"] as? [[String: Any]] else {
            throw AnalysisError.decodingError
        }

        let itemsData = try JSONSerialization.data(withJSONObject: itemsArray)
        return try JSONDecoder().decode([ItemCategoryPair].self, from: itemsData)
    }

    // MARK: - Networking

    private func performRequest(body: [String: Any]) async throws -> Data {
        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AnalysisError.apiError("Invalid response")
        }

        guard (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AnalysisError.apiError("HTTP \(http.statusCode): \(message)")
        }

        return data
    }

    private func extractToolInput(from data: Data) throws -> [String: Any] {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = json["content"] as? [[String: Any]] else {
            throw AnalysisError.decodingError
        }

        guard let toolUse = content.first(where: { ($0["type"] as? String) == "tool_use" }),
              let input = toolUse["input"] as? [String: Any] else {
            throw AnalysisError.noToolResponse
        }

        return input
    }

    // MARK: - Prompts

    private let analyzePrompt = """
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

    private var sanityCheckPrompt: String {
        let sections = StoreSections.sectionOrder.joined(separator: ", ")
        return """
            You are a grocery store categorization expert. Review the following grocery items and their \
            assigned store sections. Fix any miscategorizations and assign better categories to items \
            marked "Other".

            Preferred store sections: \(sections)

            If an item does not fit well into any of the above sections, you may propose a new short, \
            Title Case section name (e.g., "Baby Products", "Pet Supplies", "Health & Beauty"). Only \
            create a new section when the standard ones are a genuinely poor fit.

            Items to review:

            """
    }

    // MARK: - Tool Definitions

    private let grocerySectionsTool: [String: Any] = [
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
                            "name": [
                                "type": "string",
                                "description": "Descriptive name for this section",
                            ] as [String: Any],
                            "type": [
                                "type": "string",
                                "enum": ["grocery", "meal_plan", "crossed_out", "notes"],
                                "description": "Type of section",
                            ] as [String: Any],
                            "items": [
                                "type": "array",
                                "items": ["type": "string"],
                                "description": "Items in this section",
                            ] as [String: Any],
                        ] as [String: Any],
                        "required": ["name", "type", "items"],
                    ] as [String: Any],
                ] as [String: Any]
            ] as [String: Any],
            "required": ["sections"],
        ] as [String: Any],
    ]

    private let categorizedItemsTool: [String: Any] = [
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
                            "id": [
                                "type": "string",
                                "description": "The item id (must match the input exactly)",
                            ] as [String: Any],
                            "name": [
                                "type": "string",
                                "description": "The grocery item name (must match the input exactly)",
                            ] as [String: Any],
                            "category": [
                                "type": "string",
                                "description": "The correct store section for this item. Use one of the standard sections when possible, or propose a new short Title Case section name when none fit well.",
                            ] as [String: Any],
                        ] as [String: Any],
                        "required": ["id", "name", "category"],
                    ] as [String: Any],
                ] as [String: Any]
            ] as [String: Any],
            "required": ["items"],
        ] as [String: Any],
    ]
}

// MARK: - Raw Decoding Helpers

private struct RawSection: Decodable {
    let name: String
    let type: String
    let items: [String]
}
