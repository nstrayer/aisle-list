import Foundation
import SwiftData

enum Route: Hashable {
    case apiKey
    case upload
    case clarify([GrocerySection])
    case list(ListSession)

    static func == (lhs: Route, rhs: Route) -> Bool {
        switch (lhs, rhs) {
        case (.apiKey, .apiKey):
            return true
        case (.upload, .upload):
            return true
        case (.clarify(let a), .clarify(let b)):
            return a == b
        case (.list(let a), .list(let b)):
            return a === b
        case _:
            return false
        }
    }

    func hash(into hasher: inout Hasher) {
        switch self {
        case .apiKey:
            hasher.combine(0)
        case .upload:
            hasher.combine(1)
        case .clarify(let sections):
            hasher.combine(2)
            hasher.combine(sections)
        case .list(let session):
            hasher.combine(3)
            hasher.combine(ObjectIdentifier(session))
        }
    }
}
