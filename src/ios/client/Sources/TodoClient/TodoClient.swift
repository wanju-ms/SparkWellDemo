import Foundation

public enum TodoStatus: String, Codable, CaseIterable, Sendable {
    case incomplete
    case completed
    case overdue

    public var title: String {
        switch self {
        case .incomplete: "Incomplete"
        case .completed: "Completed"
        case .overdue: "Overdue"
        }
    }
}

public enum ManualTodoStatus: String, Codable, CaseIterable, Sendable {
    case incomplete
    case completed

    public var title: String { rawValue.capitalized }
}

public struct Todo: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let task: String
    public let description: String
    public let status: TodoStatus
    public let createdAt: String
    public let dueAt: String?

    public init(id: String, task: String, description: String, status: TodoStatus, createdAt: String, dueAt: String? = nil) {
        self.id = id
        self.task = task
        self.description = description
        self.status = status
        self.createdAt = createdAt
        self.dueAt = dueAt
    }

    public var input: TodoInput {
        TodoInput(task: task, description: description, status: ManualTodoStatus(rawValue: status.rawValue), dueAt: .some(dueAt))
    }

    private enum CodingKeys: String, CodingKey { case id, task, description, status, createdAt, dueAt }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(task, forKey: .task)
        try container.encode(description, forKey: .description)
        try container.encode(status, forKey: .status)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(dueAt, forKey: .dueAt)
    }
}

public struct TodoInput: Codable, Equatable, Sendable {
    public static let taskLimit = 300
    public static let descriptionLimit = 1000

    public var task: String
    public var description: String
    public var status: ManualTodoStatus?
    public var dueAt: String??

    public init(task: String = "", description: String = "", status: ManualTodoStatus? = .incomplete, dueAt: String?? = .some(nil)) {
        self.task = task
        self.description = description
        self.status = status
        self.dueAt = dueAt
    }

    private enum CodingKeys: String, CodingKey { case task, description, status, dueAt }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        task = try container.decode(String.self, forKey: .task)
        description = try container.decode(String.self, forKey: .description)
        status = try container.decodeIfPresent(ManualTodoStatus.self, forKey: .status)
        dueAt = container.contains(.dueAt) ? .some(try container.decodeIfPresent(String.self, forKey: .dueAt)) : nil
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(task, forKey: .task)
        try container.encode(description, forKey: .description)
        try container.encodeIfPresent(status, forKey: .status)
        if let dueAt { try container.encode(dueAt, forKey: .dueAt) }
    }

    public var validationErrors: [String: String] {
        var errors: [String: String] = [:]
        if task.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors["task"] = "Enter a task."
        } else if task.count > Self.taskLimit {
            errors["task"] = "Use \(Self.taskLimit) characters or fewer."
        }
        if description.count > Self.descriptionLimit {
            errors["description"] = "Use \(Self.descriptionLimit) characters or fewer."
        }
        if let dueAt = dueAt ?? nil {
            let parsed = (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(dueAt))
                ?? (try? Date.ISO8601FormatStyle().parse(dueAt))
            if parsed == nil { errors["dueAt"] = "Enter a valid date and time." }
        }
        return errors
    }
}

public enum TodoClientError: LocalizedError, Sendable {
    case api(status: Int, code: String, message: String, fields: [String: String])
    case statusConflict(current: Todo, message: String)
    case invalidResponse

    public var current: Todo? {
        if case let .statusConflict(current, _) = self { return current }
        return nil
    }

    public var errorDescription: String? {
        switch self {
        case let .api(_, _, message, _): message
        case let .statusConflict(_, message): message
        case .invalidResponse: "The service returned an unreadable response."
        }
    }
}

public struct TodoAPIClient: Sendable {
    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func list() async throws -> [Todo] {
        try await send(method: "GET")
    }

    public func create(_ input: TodoInput) async throws -> Todo {
        try await send(method: "POST", input: input)
    }

    public func update(id: String, input: TodoInput) async throws -> Todo {
        try await send(method: "PUT", id: id, input: input)
    }

    public func delete(id: String) async throws {
        let (_, response) = try await request(method: "DELETE", id: id)
        guard response.statusCode == 204 else { throw TodoClientError.invalidResponse }
    }

    private func send<Result: Decodable & Sendable>(method: String, id: String? = nil, input: TodoInput? = nil) async throws -> Result {
        let (data, _) = try await request(method: method, id: id, input: input)
        do {
            return try JSONDecoder().decode(Result.self, from: data)
        } catch {
            throw TodoClientError.invalidResponse
        }
    }

    private func request(method: String, id: String? = nil, input: TodoInput? = nil) async throws -> (Data, HTTPURLResponse) {
        var url = baseURL.appending(component: "todos")
        if let id { url = url.appending(component: id) }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let input {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(input)
        }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw TodoClientError.invalidResponse }
        guard (200..<300).contains(response.statusCode) else {
            let error = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            if response.statusCode == 409, let current = error?.current {
                throw TodoClientError.statusConflict(current: current, message: error?.message ?? "The Todo status changed.")
            }
            throw TodoClientError.api(
                status: response.statusCode,
                code: error?.code ?? "service_error",
                message: error?.message ?? "The service could not complete the request.",
                fields: error?.fields ?? [:]
            )
        }
        return (data, response)
    }

    private struct ErrorResponse: Decodable {
        let code: String
        let message: String
        let fields: [String: String]?
        let current: Todo?
    }
}