import SwiftUI

private struct GroceryAnalysisServiceKey: EnvironmentKey {
    static let defaultValue: GroceryAnalysisService = DirectAnthropicService(apiKey: "")
}

extension EnvironmentValues {
    var groceryAnalysisService: GroceryAnalysisService {
        get { self[GroceryAnalysisServiceKey.self] }
        set { self[GroceryAnalysisServiceKey.self] = newValue }
    }
}
