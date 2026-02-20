import Foundation

struct ItemCategoryPair: Codable {
    let id: String
    let name: String
    let category: String
}

protocol GroceryAnalysisService {
    func analyzeImage(_ imageBase64: String, mediaType: String) async throws -> [GrocerySection]
    func sanityCheckCategories(_ items: [ItemCategoryPair]) async throws -> [ItemCategoryPair]
}
