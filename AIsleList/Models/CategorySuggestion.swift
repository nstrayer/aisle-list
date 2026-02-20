import Foundation

struct CategorySuggestion: Identifiable, Codable {
    let id: String
    var name: String
    var from: String
    var to: String
}
