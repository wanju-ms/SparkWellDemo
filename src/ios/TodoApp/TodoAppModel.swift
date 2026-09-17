import Foundation
import Observation
import TodoClient

@MainActor
@Observable
final class TodoAppModel {
    private(set) var todos: [Todo] = []
    private(set) var isLoading = false
    private(set) var hasLoaded = false
    private(set) var loadError: String?
    private(set) var deletingId: String?
    private(set) var deletedIds = Set<String>()
    private let endpoint: String
    @ObservationIgnored private var pollingTask: Task<Void, Never>?
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    @ObservationIgnored private var isActive = false
    @ObservationIgnored private var queuedRefresh = false
    @ObservationIgnored private var revision = 0

    init(endpoint: String? = nil) {
        self.endpoint = endpoint
            ?? ProcessInfo.processInfo.environment["TODO_API_BASE_URL"]
            ?? Bundle.main.object(forInfoDictionaryKey: "TodoAPIBaseURL") as? String
            ?? "http://127.0.0.1:3000"
    }

    func load() async {
        requestLoad()
        await refreshTask?.value
    }

    func setActive(_ active: Bool) {
        guard isActive != active else { return }
        isActive = active
        revision += 1
        if active {
            requestLoad()
            pollingTask = Task { [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(5)) } catch { return }
                    guard let self else { return }
                    self.requestLoad()
                }
            }
        } else {
            pollingTask?.cancel()
            pollingTask = nil
            queuedRefresh = false
            refreshTask?.cancel()
        }
    }

    private func requestLoad() {
        guard isActive else { return }
        guard refreshTask == nil else {
            queuedRefresh = true
            return
        }
        isLoading = true
        let startedRevision = revision
        refreshTask = Task { [weak self] in
            guard let self else { return }
            defer {
                isLoading = false
                refreshTask = nil
                if queuedRefresh && isActive {
                    queuedRefresh = false
                    requestLoad()
                }
            }
            do {
                let loaded = try await service().list()
                guard !Task.isCancelled, isActive, startedRevision == revision else { return }
                let present = Set(loaded.map(\.id))
                deletedIds.formUnion(todos.map(\.id).filter { !present.contains($0) })
                todos = loaded.filter { !self.deletedIds.contains($0.id) }
                hasLoaded = true
                loadError = nil
            } catch {
                guard !Task.isCancelled, isActive, startedRevision == revision else { return }
                loadError = hasLoaded
                    ? "Could not refresh todos. Check the connection and try again."
                    : "Could not load todos. Check the connection and try again."
            }
        }
    }

    func save(_ input: TodoInput, target: Todo?) async throws {
        let client = try service()
        do {
            let saved: Todo
            if let target {
                guard !deletedIds.contains(target.id) else {
                    throw TodoClientError.api(status: 404, code: "not_found", message: "This Todo was deleted.", fields: [:])
                }
                saved = try await client.update(id: target.id, input: input)
            } else {
                saved = try await client.create(input)
            }
            guard apply(saved) else {
                throw TodoClientError.api(status: 404, code: "not_found", message: "This Todo was deleted.", fields: [:])
            }
        } catch let error as TodoClientError {
            if let target, case let .api(status, _, _, _) = error, status == 404 { remove(target.id) }
            if let current = error.current { apply(current) }
            throw error
        }
    }

    func delete(_ todo: Todo) async throws {
        guard deletingId == nil else { return }
        deletingId = todo.id
        defer { deletingId = nil }
        try await service().delete(id: todo.id)
        remove(todo.id)
    }

    private func remove(_ id: String) {
        deletedIds.insert(id)
        revision += 1
        if refreshTask != nil { queuedRefresh = true }
        todos.removeAll { $0.id == id }
    }

    @discardableResult
    private func apply(_ saved: Todo) -> Bool {
        guard !deletedIds.contains(saved.id) else { return false }
        revision += 1
        if refreshTask != nil { queuedRefresh = true }
        if let index = todos.firstIndex(where: { $0.id == saved.id }) {
            todos[index] = saved
        } else {
            todos.append(saved)
        }
        return true
    }

    private func service() throws -> TodoAPIClient {
        guard let url = URL(string: endpoint),
              ["http", "https"].contains(url.scheme),
              url.host != nil else { throw URLError(.badURL) }
        return TodoAPIClient(baseURL: url)
    }

    deinit {
        pollingTask?.cancel()
        refreshTask?.cancel()
    }
}