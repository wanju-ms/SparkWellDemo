import Foundation
import Testing
@testable import TodoClient

@Test func newDraftDefaultsAndValidation() {
    let draft = TodoInput()
    #expect(draft.task.isEmpty)
    #expect(draft.description.isEmpty)
    #expect(draft.status == .incomplete)
    #expect(draft.validationErrors["task"] != nil)
    #expect(TodoInput(task: " \n\t").validationErrors["task"] != nil)
    #expect(TodoInput(task: "A task").validationErrors.isEmpty)
}

@Test func inclusiveGraphemeBoundaries() {
    let cluster = "\u{1F469}\u{200D}\u{1F4BB}"
    let draft = TodoInput(task: String(repeating: cluster, count: 300), description: String(repeating: "e\u{0301}", count: 1000))
    #expect(draft.validationErrors.isEmpty)
    var tooLong = draft
    tooLong.task += cluster
    tooLong.description += "a"
    #expect(tooLong.validationErrors["task"] != nil)
    #expect(tooLong.validationErrors["description"] != nil)
    #expect(draft.task.count == 300)
    #expect(draft.description.count == 1000)
}

@Test func contractEncodingAndIndependentDraft() throws {
    let todo = Todo(id: "stable-id", task: "Review", description: "Notes", status: .incomplete, createdAt: "2026-09-15T23:59:59.123Z")
    var draft = todo.input
    draft.task = "Changed"
    #expect(todo.task == "Review")
    #expect(todo.createdAt == "2026-09-15T23:59:59.123Z")
    let encoded = try JSONEncoder().encode(draft)
    let object = try #require(JSONSerialization.jsonObject(with: encoded) as? NSDictionary)
    #expect(object == ["task": "Changed", "description": "Notes", "status": "incomplete", "dueAt": NSNull()] as NSDictionary)
    #expect(try JSONDecoder().decode(Todo.self, from: JSONEncoder().encode(todo)) == todo)
    #expect(throws: DecodingError.self) {
        try JSONDecoder().decode(TodoStatus.self, from: Data("\"pending\"".utf8))
    }
}

@Test func creationTimeIsRequiredAndPreservedByCodable() throws {
    let fields: [String: Any] = [
        "id": "from-server",
        "task": "Review",
        "description": "",
        "status": "incomplete",
        "createdAt": "2026-09-15T23:59:59.123Z",
        "dueAt": NSNull(),
    ]
    let data = try JSONSerialization.data(withJSONObject: fields)
    let todo = try JSONDecoder().decode(Todo.self, from: data)
    #expect(todo.createdAt == fields["createdAt"] as? String)
    let encoded = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(todo)) as? NSDictionary)
    #expect(encoded == fields as NSDictionary)

    var missingCreationTime = fields
    missingCreationTime.removeValue(forKey: "createdAt")
    let missingData = try JSONSerialization.data(withJSONObject: missingCreationTime)
    #expect(throws: DecodingError.self) {
        try JSONDecoder().decode(Todo.self, from: missingData)
    }
}

@Test func deadlineUpdatesDistinguishOmissionFromClearingAndNeverSubmitSystemStatus() throws {
    let omitted = TodoInput(task: "Content edit", status: nil, dueAt: nil)
    let omittedJSON = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(omitted)) as? NSDictionary)
    #expect(omittedJSON == ["task": "Content edit", "description": ""] as NSDictionary)
    let cleared = TodoInput(task: "Recover", status: nil, dueAt: .some(nil))
    let clearJSON = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(cleared)) as? NSDictionary)
    #expect(clearJSON == ["task": "Recover", "description": "", "dueAt": NSNull()] as NSDictionary)
    #expect(try JSONDecoder().decode(TodoInput.self, from: JSONEncoder().encode(cleared)) == cleared)
    #expect(try JSONDecoder().decode(TodoInput.self, from: JSONEncoder().encode(omitted)) == omitted)
    let overdue = Todo(id: "overdue", task: "Old task", description: "", status: .overdue, createdAt: "2026-09-14T00:00:00Z", dueAt: "2026-09-15T00:00:00Z")
    #expect(overdue.input.status == nil)
    #expect(overdue.input.validationErrors.isEmpty)
    #expect(TodoInput(task: "Invalid date", dueAt: .some("not-a-date")).validationErrors["dueAt"] != nil)
    #expect(throws: DecodingError.self) {
        try JSONDecoder().decode(ManualTodoStatus.self, from: Data("\"overdue\"".utf8))
    }
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["TODO_TEST_API_URL"] != nil))
func liveServiceMatchesTheContract() async throws {
    let address = try #require(ProcessInfo.processInfo.environment["TODO_TEST_API_URL"])
    let client = TodoAPIClient(baseURL: try #require(URL(string: address)))
    let original = try await client.list()
    let input = TodoInput(task: "Swift client \(UUID().uuidString)", description: "From URLSession")
    let created = try await client.create(input)
    #expect(created.input == input)
    let timestampFormat = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    #expect((try? timestampFormat.parse(created.createdAt)) != nil)
    #expect(created.createdAt.hasSuffix("Z"))
    let changed = TodoInput(task: input.task, description: "Updated", status: .completed)
    let updated = try await client.update(id: created.id, input: changed)
    #expect(updated.id == created.id)
    #expect(updated.input == changed)
    #expect(updated.createdAt == created.createdAt)
    let reloaded = try await client.list()
    #expect(reloaded.contains(updated))
    #expect(reloaded.count == original.count + 1)
    do {
        _ = try await client.update(id: "missing-\(UUID().uuidString)", input: input)
        Issue.record("A missing ID must not be created by update")
    } catch TodoClientError.api(let status, let code, _, _) {
        #expect(status == 404)
        #expect(code == "not_found")
    }
    do {
        _ = try await client.create(TodoInput(task: String(repeating: "a", count: 301)))
        Issue.record("The server must enforce Todo field limits")
    } catch TodoClientError.api(let status, let code, _, let fields) {
        #expect(status == 422)
        #expect(code == "validation_error")
        #expect(fields["task"] != nil)
    }

    let overdue = try await client.create(TodoInput(task: "Overdue", dueAt: .some("2020-01-01T00:00:00Z")))
    #expect(overdue.status == .overdue)
    do {
        _ = try await client.update(id: overdue.id, input: TodoInput(task: "Not saved", status: .completed))
        Issue.record("An overdue record must reject a manual status")
    } catch TodoClientError.statusConflict(let current, _) {
        #expect(current == overdue)
    }
    let contentEdit = try await client.update(id: overdue.id, input: TodoInput(task: "Content edit", status: nil, dueAt: nil))
    #expect(contentEdit.status == .overdue)
    #expect(contentEdit.dueAt == overdue.dueAt)
    let recovered = try await client.update(id: overdue.id, input: TodoInput(task: "Recovered", status: nil, dueAt: .some(nil)))
    #expect(recovered.status == .incomplete)
    #expect(recovered.dueAt == nil)
    #expect(recovered.createdAt == overdue.createdAt)

    try await client.delete(id: updated.id)
    let otherClient = TodoAPIClient(baseURL: client.baseURL)
    try await otherClient.delete(id: updated.id)
    let afterDelete = try await otherClient.list()
    #expect(!afterDelete.contains { $0.id == updated.id })
    #expect(afterDelete.contains(recovered))
    do {
        _ = try await client.update(id: updated.id, input: changed)
        Issue.record("An update must not recreate a deleted Todo")
    } catch TodoClientError.api(let status, let code, _, _) {
        #expect(status == 404)
        #expect(code == "not_found")
    }
    try await client.delete(id: recovered.id)
    #expect(try await client.list() == original)
}