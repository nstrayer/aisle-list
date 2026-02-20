import Foundation

struct GrocerySection: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var type: SectionType
    var items: [String]

    enum SectionType: String, Codable, CaseIterable {
        case grocery
        case mealPlan = "meal_plan"
        case crossedOut = "crossed_out"
        case notes
    }

    init(id: UUID = UUID(), name: String, type: SectionType, items: [String]) {
        self.id = id
        self.name = name
        self.type = type
        self.items = items
    }
}
