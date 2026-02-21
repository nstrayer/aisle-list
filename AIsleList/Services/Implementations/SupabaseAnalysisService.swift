import Foundation
import Supabase

enum SupabaseAnalysisError: LocalizedError {
    case notAuthenticated
    case scanLimitReached(scansUsed: Int, scanLimit: Int)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be signed in to scan lists."
        case .scanLimitReached(let used, let limit):
            return "You've used all \(used) of \(limit) free scans this month."
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}

final class SupabaseAnalysisService: GroceryAnalysisService {

    private let client: SupabaseClient

    init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - Analyze Image

    func analyzeImage(_ imageBase64: String, mediaType: String) async throws -> [GrocerySection] {
        let payload: [String: Any] = [
            "action": "analyze",
            "imageBase64": imageBase64,
            "mediaType": mediaType,
        ]

        let result = try await invokeFunction(payload: payload)

        guard let sections = result["sections"] as? [[String: Any]] else {
            throw AnalysisError.decodingError
        }

        let data = try JSONSerialization.data(withJSONObject: sections)
        let raw = try JSONDecoder().decode([RawSection].self, from: data)

        return raw.map { section in
            GrocerySection(
                name: section.name,
                type: GrocerySection.SectionType(rawValue: section.type) ?? .grocery,
                items: section.items
            )
        }
    }

    // MARK: - Sanity Check

    func sanityCheckCategories(_ items: [ItemCategoryPair]) async throws -> [ItemCategoryPair] {
        let itemDicts = items.map { item -> [String: String] in
            ["id": item.id, "name": item.name, "category": item.category]
        }

        let payload: [String: Any] = [
            "action": "sanity_check",
            "items": itemDicts,
        ]

        let result = try await invokeFunction(payload: payload)

        guard let itemsArray = result["items"] as? [[String: Any]] else {
            throw AnalysisError.decodingError
        }

        let data = try JSONSerialization.data(withJSONObject: itemsArray)
        return try JSONDecoder().decode([ItemCategoryPair].self, from: data)
    }

    // MARK: - Private

    private func invokeFunction(payload: [String: Any]) async throws -> [String: Any] {
        let bodyData = try JSONSerialization.data(withJSONObject: payload)

        let response = try await client.functions.invoke(
            "analyze-grocery-list",
            options: .init(body: bodyData)
        )

        let json = try JSONSerialization.jsonObject(with: response) as? [String: Any]

        guard let json else {
            throw AnalysisError.decodingError
        }

        // Check for error responses embedded in the JSON
        if let error = json["error"] as? String {
            if error == "scan_limit_reached" {
                throw SupabaseAnalysisError.scanLimitReached(
                    scansUsed: json["scansUsed"] as? Int ?? 0,
                    scanLimit: json["scanLimit"] as? Int ?? 3
                )
            }
            throw SupabaseAnalysisError.serverError(error)
        }

        return json
    }
}

private struct RawSection: Decodable {
    let name: String
    let type: String
    let items: [String]
}
