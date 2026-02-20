import SwiftUI

struct GroceryAnalysisServiceKey: EnvironmentKey {
    static let defaultValue: (any GroceryAnalysisService)? = nil
}

extension EnvironmentValues {
    var analysisService: (any GroceryAnalysisService)? {
        get { self[GroceryAnalysisServiceKey.self] }
        set { self[GroceryAnalysisServiceKey.self] = newValue }
    }
}
