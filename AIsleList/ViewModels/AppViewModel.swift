import Foundation
import SwiftUI
import SwiftData
import Observation

@Observable
final class AppViewModel {

    // MARK: - Navigation

    var currentRoute: Route = .apiKey

    // MARK: - Analysis State

    var isAnalyzing = false
    var analysisError: String?

    // MARK: - Sanity Check State

    var isSanityChecking = false
    var pendingSuggestions: [CategorySuggestion]?
    var sanityCheckError: String?

    // MARK: - Session State

    var currentSession: ListSession?
    var uploadedImage: UIImage?

    // MARK: - Private

    private var sanityCheckTask: Task<Void, Never>?
    private var lastCheckedFingerprint: String?

    /// Lookup table for canonicalizing AI-returned category names to standard section names.
    private static let sectionLookup: [String: String] = {
        var lookup: [String: String] = [:]
        for section in StoreSections.sectionOrder {
            lookup[section.lowercased()] = section
        }
        return lookup
    }()

    // MARK: - Computed

    var itemsChangedSinceCheck: Bool {
        guard let fingerprint = lastCheckedFingerprint,
              let session = currentSession else { return false }
        return getItemsFingerprint(session.items) != fingerprint
    }

    // MARK: - Image Upload

    func handleImageUpload(_ image: UIImage, using service: any GroceryAnalysisService) async {
        isAnalyzing = true
        analysisError = nil
        uploadedImage = image

        let processed = ImagePreprocessor.preprocessForAPI(image)

        do {
            let sections = try await service.analyzeImage(processed.base64, mediaType: "image/jpeg")
            currentRoute = .clarify(sections)
        } catch {
            analysisError = error.localizedDescription
        }

        isAnalyzing = false
    }

    // MARK: - Confirm Sections

    func handleConfirmSections(_ selected: [GrocerySection], modelContext: ModelContext) {
        var sortOrder = 0
        var items: [GroceryItem] = []

        for section in selected {
            for itemName in section.items {
                let item = GroceryItem(
                    name: itemName,
                    category: StoreSections.categorizeItem(itemName),
                    sortOrder: sortOrder
                )
                items.append(item)
                sortOrder += 1
            }
        }

        // Generate session name
        let existingNames = fetchExistingSessionNames(modelContext: modelContext)
        let name = generateSessionName(existingNames: existingNames)

        // Create session
        let session = ListSession(name: name)
        session.items = items
        for item in items {
            item.session = session
        }

        // Save thumbnail
        if let image = uploadedImage {
            session.thumbnailData = ImagePreprocessor.createThumbnail(image)
        }

        modelContext.insert(session)
        try? modelContext.save()
        currentSession = session
        currentRoute = .list(session)
    }

    // MARK: - Sanity Check

    func runSanityCheck(items: [GroceryItem], using service: any GroceryAnalysisService) async {
        // Cancel any in-flight check
        sanityCheckTask?.cancel()

        let task = Task { @MainActor [weak self] in
            guard let self else { return }

            self.isSanityChecking = true
            self.pendingSuggestions = nil
            self.sanityCheckError = nil

            do {
                let pairs = items.map { ItemCategoryPair(id: $0.id, name: $0.name, category: $0.category) }
                let corrected = try await service.sanityCheckCategories(pairs)

                guard !Task.isCancelled else { return }

                // Build corrected map, canonicalize names
                var correctedMap: [String: String] = [:]
                for c in corrected {
                    correctedMap[c.id] = Self.canonicalizeCategory(c.category)
                }

                // Diff against current
                var diffs: [CategorySuggestion] = []
                for item in items {
                    if let newCategory = correctedMap[item.id], newCategory != item.category {
                        diffs.append(CategorySuggestion(
                            id: item.id,
                            name: item.name,
                            from: item.category,
                            to: newCategory
                        ))
                    }
                }

                self.lastCheckedFingerprint = self.getItemsFingerprint(items)
                if !diffs.isEmpty {
                    self.pendingSuggestions = diffs
                }
            } catch {
                guard !Task.isCancelled else { return }
                self.sanityCheckError = "Category refinement failed -- items may be in wrong sections."
            }

            if !Task.isCancelled {
                self.isSanityChecking = false
            }
        }

        sanityCheckTask = task
    }

    // MARK: - Accept / Reject Suggestions

    func acceptSuggestions() {
        guard let suggestions = pendingSuggestions,
              let session = currentSession else { return }

        var suggestionMap: [String: String] = [:]
        for s in suggestions {
            suggestionMap[s.id] = s.to
        }

        for item in session.items {
            if let newCategory = suggestionMap[item.id] {
                item.category = newCategory
            }
        }

        pendingSuggestions = nil
    }

    func rejectSuggestions() {
        pendingSuggestions = nil
    }

    // MARK: - Recategorize

    func recategorize(using service: any GroceryAnalysisService) {
        guard let session = currentSession, !session.items.isEmpty else { return }
        let items = session.items
        Task {
            await runSanityCheck(items: items, using: service)
        }
    }

    // MARK: - New List

    func handleNewList() {
        sanityCheckTask?.cancel()
        currentSession = nil
        uploadedImage = nil
        analysisError = nil
        pendingSuggestions = nil
        sanityCheckError = nil
        isSanityChecking = false
        lastCheckedFingerprint = nil
        currentRoute = .upload
    }

    // MARK: - Load Session

    func loadSession(_ session: ListSession) {
        sanityCheckTask?.cancel()
        currentSession = session
        pendingSuggestions = nil
        sanityCheckError = nil
        isSanityChecking = false
        lastCheckedFingerprint = nil

        // Restore thumbnail as UIImage
        if let data = session.thumbnailData {
            uploadedImage = UIImage(data: data)
        } else {
            uploadedImage = nil
        }

        currentRoute = .list(session)
    }

    // MARK: - Back to Upload

    func handleBackToUpload() {
        uploadedImage = nil
        analysisError = nil
        currentRoute = .upload
    }

    // MARK: - Private Helpers

    private func getItemsFingerprint(_ items: [GroceryItem]) -> String {
        items
            .map { "\($0.id):\($0.name)" }
            .sorted()
            .joined(separator: "|")
    }

    private static func canonicalizeCategory(_ category: String) -> String {
        let trimmed = category.trimmingCharacters(in: .whitespaces)
        return sectionLookup[trimmed.lowercased()] ?? trimmed
    }

    private func generateSessionName(existingNames: [String]) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        let baseName = formatter.string(from: Date())

        var name = baseName
        var suffix = 1
        while existingNames.contains(name) {
            suffix += 1
            name = "\(baseName) (\(suffix))"
        }
        return name
    }

    private func fetchExistingSessionNames(modelContext: ModelContext) -> [String] {
        let descriptor = FetchDescriptor<ListSession>()
        let sessions = (try? modelContext.fetch(descriptor)) ?? []
        return sessions.map(\.name)
    }
}
