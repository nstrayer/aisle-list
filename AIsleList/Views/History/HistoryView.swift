import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(sort: \ListSession.createdAt, order: .reverse) private var sessions: [ListSession]
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let onSelect: (ListSession) -> Void

    @State private var sessionToRename: ListSession?
    @State private var renameText = ""

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty {
                    ContentUnavailableView(
                        "No Saved Lists",
                        systemImage: "list.clipboard",
                        description: Text("Your past grocery lists will appear here.")
                    )
                } else {
                    List {
                        ForEach(sessions) { session in
                            Button {
                                onSelect(session)
                                dismiss()
                            } label: {
                                SessionRow(session: session)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    delete(session)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .swipeActions(edge: .leading) {
                                Button {
                                    sessionToRename = session
                                    renameText = session.name
                                } label: {
                                    Label("Rename", systemImage: "pencil")
                                }
                                .tint(.orange)
                            }
                        }
                    }
                }
            }
            .navigationTitle("List History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Rename List", isPresented: .init(
                get: { sessionToRename != nil },
                set: { if !$0 { sessionToRename = nil } }
            )) {
                TextField("List name", text: $renameText)
                Button("Save") {
                    if let session = sessionToRename, !renameText.trimmingCharacters(in: .whitespaces).isEmpty {
                        session.name = renameText.trimmingCharacters(in: .whitespaces)
                        session.updatedAt = Date()
                    }
                    sessionToRename = nil
                }
                Button("Cancel", role: .cancel) {
                    sessionToRename = nil
                }
            }
        }
    }

    private func delete(_ session: ListSession) {
        modelContext.delete(session)
    }
}
