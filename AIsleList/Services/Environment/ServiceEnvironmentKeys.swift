import SwiftUI

struct GroceryAnalysisServiceKey: EnvironmentKey {
    static let defaultValue: (any GroceryAnalysisService)? = nil
}

struct AuthServiceKey: EnvironmentKey {
    static let defaultValue: (any AuthService)? = nil
}

extension EnvironmentValues {
    var analysisService: (any GroceryAnalysisService)? {
        get { self[GroceryAnalysisServiceKey.self] }
        set { self[GroceryAnalysisServiceKey.self] = newValue }
    }

    var authService: (any AuthService)? {
        get { self[AuthServiceKey.self] }
        set { self[AuthServiceKey.self] = newValue }
    }
}
