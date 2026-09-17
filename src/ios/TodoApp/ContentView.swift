//
//  ContentView.swift
//  TodoApp
//
//  Created by Jun Wang on 9/14/26.
//

import SwiftUI
import TodoClient

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var model = TodoAppModel()
    @State private var editor: EditorSession?
    @State private var deletion: DeletionPrompt?
    @ScaledMetric(relativeTo: .caption) private var timestampColumnWidth = 88

    var body: some View {
        NavigationStack {
            Group {
                if !model.hasLoaded && (model.isLoading || model.loadError == nil) {
                    ProgressView("Loading todos")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if !model.hasLoaded, let error = model.loadError {
                    ContentUnavailableView {
                        Label("Could not load todos", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry", systemImage: "arrow.clockwise") {
                            Task { await model.load() }
                        }
                        .buttonStyle(.bordered)
                    }
                } else if model.todos.isEmpty {
                    ContentUnavailableView("No todos yet", systemImage: "checklist")
                } else {
                    List {
                        Section {
                            ForEach(model.todos) { todo in
                                HStack(alignment: .top, spacing: 10) {
                                    if horizontalSizeClass == .regular {
                                        Image(systemName: todo.status == .completed ? "checkmark.circle.fill" : "circle")
                                            .font(.title3)
                                            .foregroundStyle(todo.status == .completed ? Color.teal : Color.secondary)
                                            .accessibilityHidden(true)
                                    }
                                    VStack(alignment: .leading, spacing: 7) {
                                        Text(todo.task)
                                            .font(.headline)
                                            .fixedSize(horizontal: false, vertical: true)
                                        if !todo.description.isEmpty {
                                            Text(todo.description)
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                        Text(todo.status.title)
                                            .font(.caption.weight(.medium))
                                            .foregroundStyle(todo.status == .overdue ? Color.red : todo.status == .completed ? Color.teal : Color.secondary)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    CreatedAtView(value: todo.createdAt)
                                        .frame(width: timestampColumnWidth, alignment: .leading)
                                        .accessibilityIdentifier("list-created-at")
                                    CreatedAtView(value: todo.dueAt, label: "Due at", emptyValue: "No deadline")
                                        .frame(width: timestampColumnWidth, alignment: .leading)
                                        .accessibilityIdentifier("list-due-at")
                                    VStack(spacing: 4) {
                                        Button {
                                            editor = EditorSession(todo: todo)
                                        } label: {
                                            Image(systemName: "square.and.pencil")
                                                .frame(width: 32, height: 32)
                                        }
                                        .disabled(model.deletingId == todo.id)
                                        .accessibilityLabel("Edit \(todo.task)")
                                        .help("Edit todo")
                                        Button {
                                            deletion = DeletionPrompt(todo: todo)
                                        } label: {
                                            Group {
                                                if model.deletingId == todo.id {
                                                    ProgressView()
                                                } else {
                                                    Image(systemName: "trash")
                                                }
                                            }
                                            .frame(width: 32, height: 32)
                                        }
                                        .foregroundStyle(.red)
                                        .disabled(model.deletingId != nil)
                                        .accessibilityLabel("Delete \(todo.task)")
                                        .accessibilityValue(model.deletingId == todo.id ? "Deleting" : "")
                                        .help("Delete todo")
                                    }
                                    .buttonStyle(.borderless)
                                }
                                .padding(.vertical, 9)
                            }
                        } header: {
                            HStack {
                                Text("All todos")
                                Spacer()
                                Text("\(model.todos.count)")
                            }
                        } footer: {
                            Text("\(model.todos.filter { $0.status == .completed }.count) completed")
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if model.hasLoaded, let error = model.loadError {
                    HStack {
                        Label(error, systemImage: "exclamationmark.circle")
                            .font(.caption)
                            .foregroundStyle(.red)
                        Spacer()
                        Button("Retry refresh", systemImage: "arrow.clockwise") {
                            Task { await model.load() }
                        }
                        .labelStyle(.iconOnly)
                    }
                    .padding()
                    .background(.bar)
                    .accessibilityIdentifier("refresh-error")
                }
            }
            .navigationTitle("Todo")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Reload todos", systemImage: "arrow.clockwise") {
                        Task { await model.load() }
                    }
                    .labelStyle(.iconOnly)
                    .disabled(model.isLoading)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("New todo", systemImage: "plus") {
                        editor = EditorSession(todo: nil)
                    }
                    .disabled(!model.hasLoaded)
                }
            }
            .onChange(of: scenePhase, initial: true) { _, phase in
                model.setActive(phase == .active)
            }
            .onDisappear { model.setActive(false) }
            .sheet(item: $editor) { session in
                TodoEditorView(
                    todo: session.todo.flatMap { target in model.todos.first { $0.id == target.id } } ?? session.todo,
                    deleted: session.todo.map { model.deletedIds.contains($0.id) } ?? false
                ) { input in
                    try await model.save(input, target: session.todo)
                }
            }
            .alert(deletion?.error == nil ? "Delete todo?" : "Could not delete todo", isPresented: Binding(
                get: { deletion != nil },
                set: { if !$0 { deletion = nil } }
            ), presenting: deletion) { prompt in
                Button(prompt.error == nil ? "Delete todo" : "Retry delete", role: .destructive) {
                    Task { await deleteTodo(prompt.todo) }
                }
                Button("Cancel", role: .cancel) {}
            } message: { prompt in
                Text("\(prompt.todo.task)\n\n\(prompt.error ?? "This cannot be undone.")")
            }
            .onChange(of: model.deletedIds) { _, deleted in
                if let deletion, deleted.contains(deletion.todo.id) { self.deletion = nil }
            }
        }
        .tint(.teal)
    }

    private struct EditorSession: Identifiable {
        let id = UUID()
        let todo: Todo?
    }

    private struct DeletionPrompt {
        let todo: Todo
        var error: String? = nil
    }

    private func deleteTodo(_ todo: Todo) async {
        do {
            try await model.delete(todo)
        } catch {
            if !model.deletedIds.contains(todo.id) {
                deletion = DeletionPrompt(todo: todo, error: error is TodoClientError
                    ? error.localizedDescription
                    : "Could not confirm deletion. Retry or reload to check.")
            }
        }
    }
}

#Preview {
    ContentView()
}
