import Foundation

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

    private let authService: SupabaseAuthService

    init(authService: SupabaseAuthService) {
        self.authService = authService
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
        guard let token = authService.accessToken else {
            print("[SupabaseAnalysis] accessToken is nil, authState: \(authService.authState)")
            throw SupabaseAnalysisError.notAuthenticated
        }
        print("[SupabaseAnalysis] token present (\(token.prefix(20))...), calling edge function")

        let url = authService.functionsBaseURL
            .appendingPathComponent("analyze-grocery-list")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(authService.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AnalysisError.apiError("Invalid response")
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw AnalysisError.decodingError
        }

        switch http.statusCode {
        case 200...299:
            return json
        case 401:
            print("[SupabaseAnalysis] server returned 401, body: \(json)")
            throw SupabaseAnalysisError.notAuthenticated
        case 403:
            if (json["error"] as? String) == "scan_limit_reached" {
                throw SupabaseAnalysisError.scanLimitReached(
                    scansUsed: json["scansUsed"] as? Int ?? 0,
                    scanLimit: json["scanLimit"] as? Int ?? 3
                )
            }
            throw AnalysisError.apiError("Forbidden")
        default:
            let message = json["error"] as? String ?? "Unknown error"
            throw SupabaseAnalysisError.serverError(message)
        }
    }
}

private struct RawSection: Decodable {
    let name: String
    let type: String
    let items: [String]
}
