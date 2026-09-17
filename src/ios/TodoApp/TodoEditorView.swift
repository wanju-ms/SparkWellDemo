import SwiftUI
import TodoClient

struct TodoEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var draft: TodoInput
    @State private var isSaving = false
    @State private var taskTouched = false
    @State private var failure: String?
    @FocusState private var focusedField: Field?
    private let todo: Todo?
    private let isEditing: Bool
    private let createdAt: String?
    private let deleted: Bool
    private let onSave: (TodoInput) async throws -> Void

    init(todo: Todo?, deleted: Bool = false, onSave: @escaping (TodoInput) async throws -> Void) {
        var initialDraft = todo?.input ?? TodoInput()
        initialDraft.status = initialDraft.status ?? .incomplete
        _draft = State(initialValue: initialDraft)
        self.todo = todo
        isEditing = todo != nil
        createdAt = todo?.createdAt
        self.deleted = deleted
        self.onSave = onSave
    }

    private var taskError: String? {
        (taskTouched || !draft.task.isEmpty) ? draft.validationErrors["task"] : nil
    }

    private var deadlineEnabled: Binding<Bool> {
        Binding(
            get: { (draft.dueAt ?? nil) != nil },
            set: { enabled in
                draft.dueAt = .some(enabled ? Date.now.ISO8601Format(.iso8601WithTimeZone()) : nil)
            }
        )
    }

    private var deadline: Binding<Date> {
        Binding(
            get: { CreatedAtView.date(from: draft.dueAt ?? nil) ?? .now },
            set: { draft.dueAt = .some($0.ISO8601Format(.iso8601WithTimeZone())) }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                if deleted {
                    Section {
                        Label("This Todo was deleted. Unsaved input has not been saved.", systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("deleted-notice")
                    }
                }
                Section {
                    if deleted {
                        Text(draft.task)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("deleted-task")
                    } else {
                        TextField("Task", text: $draft.task, axis: .vertical)
                            .lineLimit(2...5)
                            .focused($focusedField, equals: .task)
                            .accessibilityIdentifier("todo-task")
                    }
                } header: {
                    fieldHeader("Task", count: draft.task.count, limit: TodoInput.taskLimit)
                } footer: {
                    if let taskError { Text(taskError).foregroundStyle(.red) }
                }
                Section {
                    if deleted {
                        Text(draft.description)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("deleted-description")
                    } else {
                        TextField("Description", text: $draft.description, axis: .vertical)
                            .lineLimit(4...8)
                            .focused($focusedField, equals: .description)
                            .accessibilityIdentifier("todo-description")
                    }
                } header: {
                    fieldHeader("Description (optional)", count: draft.description.count, limit: TodoInput.descriptionLimit)
                } footer: {
                    if let error = draft.validationErrors["description"] {
                        Text(error).foregroundStyle(.red)
                    }
                }
                Section("Due at") {
                    Toggle("Deadline", isOn: deadlineEnabled)
                        .accessibilityIdentifier("deadline-enabled")
                    if deadlineEnabled.wrappedValue {
                        DatePicker("Due at", selection: deadline, displayedComponents: [.date, .hourAndMinute])
                            .accessibilityIdentifier("todo-due-at")
                    } else {
                        Text("No deadline").foregroundStyle(.secondary)
                    }
                }
                .disabled(deleted)
                Section("Status") {
                    if todo?.status == .overdue {
                        Text("Overdue")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("current-status")
                    } else {
                        Picker("Status", selection: $draft.status) {
                            ForEach(ManualTodoStatus.allCases, id: \.self) { status in
                                Text(status.title).tag(Optional(status))
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                }
                .disabled(deleted)
                Section {
                    CreatedAtView(value: createdAt)
                        .accessibilityIdentifier("editor-created-at")
                }
                if let failure, !deleted {
                    Section {
                        Label(failure, systemImage: "exclamationmark.circle")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("save-error")
                    }
                }
            }
            .disabled(isSaving && !deleted)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isEditing ? "Edit todo" : "New todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().accessibilityLabel("Saving")
                        } else {
                            Label("Save todo", systemImage: "checkmark")
                        }
                    }
                    .disabled(deleted || isSaving || !draft.validationErrors.isEmpty)
                    .accessibilityIdentifier("save-todo")
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task { focusedField = .task }
            .onChange(of: focusedField) { previous, _ in
                if previous == .task { taskTouched = true }
            }
            .onChange(of: draft) { _, _ in failure = nil }
            .onChange(of: deleted) { _, deleted in
                if deleted { focusedField = nil }
            }
        }
        .tint(.teal)
    }

    private func fieldHeader(_ title: String, count: Int, limit: Int) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
            Spacer()
            Text("\(count) / \(limit)")
                .monospacedDigit()
                .foregroundStyle(count > limit ? Color.red : Color.secondary)
        }
        .textCase(nil)
    }

    private func save() async {
        taskTouched = true
        guard !deleted, !isSaving, draft.validationErrors.isEmpty else { return }
        isSaving = true
        failure = nil
        defer { isSaving = false }
        do {
            var input = draft
            if todo?.status == .overdue { input.status = nil }
            try await onSave(input)
            dismiss()
        } catch let error as TodoClientError {
            failure = error.localizedDescription
        } catch {
            failure = "Could not reach the service. Try again."
        }
    }

    private enum Field: Hashable {
        case task
        case description
    }
}