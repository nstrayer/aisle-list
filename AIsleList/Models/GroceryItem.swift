import Foundation
import SwiftData

@Model
final class GroceryItem {
    var id: String
    var name: String
    var category: String
    var isChecked: Bool
    var sortOrder: Int
    var session: ListSession?

    init(id: String = UUID().uuidString, name: String, category: String, isChecked: Bool = false, sortOrder: Int = 0) {
        self.id = id
        self.name = name
        self.category = category
        self.isChecked = isChecked
        self.sortOrder = sortOrder
    }
}
