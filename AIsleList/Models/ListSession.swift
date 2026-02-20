import Foundation
import SwiftData

@Model
final class ListSession {
    var name: String
    var createdAt: Date
    var updatedAt: Date
    @Attribute(.externalStorage) var thumbnailData: Data?
    @Relationship(deleteRule: .cascade, inverse: \GroceryItem.session)
    var items: [GroceryItem] = []

    var itemCount: Int { items.count }
    var checkedCount: Int { items.filter(\.isChecked).count }
    var hasImage: Bool { thumbnailData != nil }

    init(name: String, createdAt: Date = Date(), updatedAt: Date = Date(), thumbnailData: Data? = nil) {
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.thumbnailData = thumbnailData
    }
}
