import Foundation

protocol GroceryAnalysisService {
    /// Analyzes a photo of a handwritten grocery list and returns identified sections.
    func analyzeImage(base64: String, mediaType: String) async throws -> [GrocerySection]

    /// Reviews item categorizations and returns corrected assignments.
    func sanityCheckCategories(items: [(id: String, name: String, category: String)]) async throws -> [(id: String, name: String, category: String)]
}
