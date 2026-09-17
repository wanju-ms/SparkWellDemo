import XCTest

@MainActor
final class TodoAppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCreateEditCancelAndReload() async throws {
        try await control("reset", body: ["todos": []])
        let app = application()
        app.launch()
        let newButton = app.buttons["New todo"]
        XCTAssertTrue(newButton.waitForExistence(timeout: 10))
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: newButton)
        await fulfillment(of: [ready], timeout: 10)

        newButton.tap()
        let taskField = app.descendants(matching: .any).matching(identifier: "todo-task").firstMatch
        XCTAssertTrue(taskField.waitForExistence(timeout: 5))
        let editorCreation = app.descendants(matching: .any).matching(identifier: "editor-created-at").firstMatch
        XCTAssertTrue(editorCreation.waitForExistence(timeout: 5))
        XCTAssertEqual(editorCreation.value as? String, "Not created yet")
        XCTAssertFalse(app.textFields["editor-created-at"].exists)
        XCTAssertFalse(editorCreation.descendants(matching: .datePicker).element.exists)
        taskField.tap()
        taskField.typeText("Discard this draft")
        app.buttons["Cancel"].tap()
        XCTAssertFalse(app.staticTexts["Discard this draft"].exists)

        newButton.tap()
        XCTAssertTrue(taskField.waitForExistence(timeout: 5))
        XCTAssertNotEqual(taskField.value as? String, "Discard this draft")
        XCTAssertEqual(editorCreation.value as? String, "Not created yet")
        let task = "iOS review \(UUID().uuidString.prefix(8))"
        taskField.tap()
        taskField.typeText(task)
        XCTAssertTrue(app.segmentedControls.buttons["Incomplete"].isSelected)
        app.buttons["save-todo"].tap()
        XCTAssertTrue(app.staticTexts[task].waitForExistence(timeout: 10))
        let row = app.cells.containing(.staticText, identifier: task).firstMatch
        let listCreation = row.descendants(matching: .any).matching(identifier: "list-created-at").firstMatch
        XCTAssertTrue(listCreation.waitForExistence(timeout: 5))
        let originalCreationTime = try XCTUnwrap(listCreation.value as? String)
        XCTAssertFalse(originalCreationTime.isEmpty)
        XCTAssertNotEqual(originalCreationTime, "Not created yet")
        XCTAssertNotEqual(originalCreationTime, "Unavailable")
        XCTAssertGreaterThanOrEqual(listCreation.frame.minX, app.staticTexts[task].frame.maxX)
        let listScreenshot = XCTAttachment(screenshot: app.screenshot())
        listScreenshot.name = "Todo creation-time column"
        listScreenshot.lifetime = .keepAlways
        add(listScreenshot)

        app.buttons["Edit \(task)"].tap()
        XCTAssertTrue(taskField.waitForExistence(timeout: 5))
        XCTAssertEqual(editorCreation.value as? String, originalCreationTime)
        app.segmentedControls.buttons["Completed"].tap()
        XCTAssertEqual(editorCreation.value as? String, originalCreationTime)
        app.buttons["save-todo"].tap()
        XCTAssertTrue(app.staticTexts[task].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts[task].waitForExistence(timeout: 10))
        XCTAssertEqual(listCreation.value as? String, originalCreationTime)
        app.buttons["Edit \(task)"].tap()
        XCTAssertTrue(taskField.waitForExistence(timeout: 5))
        XCTAssertTrue(app.segmentedControls.buttons["Completed"].isSelected)
        XCTAssertEqual(editorCreation.value as? String, originalCreationTime)
        app.swipeUp()
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Todo editor"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["Cancel"].tap()
    }

    func testLoadFailureIsNotAnEmptyCollection() {
        let app = application()
        app.launchEnvironment["TODO_API_BASE_URL"] = "http://127.0.0.1:1"
        app.launch()
        XCTAssertTrue(app.staticTexts["Could not load todos"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Retry"].exists)
        XCTAssertFalse(app.buttons["New todo"].isEnabled)
        XCTAssertFalse(app.staticTexts["No todos yet"].exists)
    }

    func testCreationTimeUsesLocalCalendarDateAndTime() async throws {
        try await control("reset", body: ["todos": [[
            "id": "fixed-time",
            "task": "Time zone review",
            "description": "Fixed UTC input",
            "status": "incomplete",
            "createdAt": "2026-09-15T00:05:06.123Z",
        ]]])
        let app = application()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_GB"]
        app.launchEnvironment["TZ"] = "America/Los_Angeles"
        app.launch()
        let row = app.cells.containing(.staticText, identifier: "Time zone review").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let listTime = row.descendants(matching: .any).matching(identifier: "list-created-at").firstMatch
        assertLocalCreationTime(listTime)

        app.buttons["Edit Time zone review"].tap()
        let editorTime = app.descendants(matching: .any).matching(identifier: "editor-created-at").firstMatch
        XCTAssertTrue(editorTime.waitForExistence(timeout: 5))
        assertLocalCreationTime(editorTime)
        XCTAssertFalse(app.textFields["editor-created-at"].exists)
        XCTAssertFalse(editorTime.descendants(matching: .datePicker).element.exists)
        app.buttons["Cancel"].tap()
    }

    func testNewTodoKeepsDraftAndPlaceholderDuringPendingAndFailedSave() async throws {
        try await control("reset", body: ["todos": []])
        let app = application()
        app.launch()
        let newButton = app.buttons["New todo"]
        XCTAssertTrue(newButton.waitForExistence(timeout: 10))
        newButton.tap()
        let taskField = app.descendants(matching: .any).matching(identifier: "todo-task").firstMatch
        XCTAssertTrue(taskField.waitForExistence(timeout: 5))
        taskField.tap()
        taskField.typeText("Keep this new draft")
        let creation = app.descendants(matching: .any).matching(identifier: "editor-created-at").firstMatch
        XCTAssertEqual(creation.value as? String, "Not created yet")

        try await control("pause", body: [:])
        try await assertPendingSave(
            in: app,
            title: "New todo",
            creationValue: "Not created yet",
            method: "POST",
            path: "/todos",
            input: ["task": "Keep this new draft", "description": "", "status": "incomplete", "dueAt": NSNull()]
        )
        let pendingState = try await control("state", body: [:])
        XCTAssertEqual((pendingState["todos"] as? [Any])?.count, 0)

        try await control("fail", body: [:])
        let error = app.descendants(matching: .any).matching(identifier: "save-error").firstMatch
        XCTAssertTrue(error.waitForExistence(timeout: 5))
        XCTAssertEqual(taskField.value as? String, "Keep this new draft")
        XCTAssertTrue(app.segmentedControls.buttons["Incomplete"].isSelected)
        XCTAssertEqual(creation.value as? String, "Not created yet")
        XCTAssertTrue(app.buttons["Cancel"].isEnabled)
        XCTAssertTrue(app.buttons["save-todo"].isEnabled)
        let failedState = try await control("state", body: [:])
        XCTAssertEqual((failedState["todos"] as? [Any])?.count, 0)

        app.buttons["save-todo"].tap()
        XCTAssertTrue(app.staticTexts["Keep this new draft"].waitForExistence(timeout: 10))
        XCTAssertFalse(creation.exists)
        let savedState = try await control("state", body: [:])
        let records = try XCTUnwrap(savedState["todos"] as? [[String: Any]])
        XCTAssertEqual(records.count, 1)
        XCTAssertNotNil(records.first?["createdAt"])
        let attempts = try XCTUnwrap(savedState["writes"] as? [[String: Any]])
        XCTAssertEqual(attempts.count, 2)
        for attempt in attempts {
            XCTAssertEqual(attempt["body"] as? NSDictionary, ["task": "Keep this new draft", "description": "", "status": "incomplete", "dueAt": NSNull()] as NSDictionary)
        }
    }

    func testExistingTodoKeepsCreationTimeAndDraftAfterFailedSave() async throws {
        let original: [String: Any] = [
            "id": "existing-time",
            "task": "Existing task",
            "description": "",
            "status": "incomplete",
            "createdAt": "2026-09-15T00:05:06.123Z",
            "dueAt": NSNull(),
        ]
        try await control("reset", body: ["todos": [original]])
        let app = application()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_GB"]
        app.launchEnvironment["TZ"] = "America/Los_Angeles"
        app.launch()
        let edit = app.buttons["Edit Existing task"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let descriptionField = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        XCTAssertTrue(descriptionField.waitForExistence(timeout: 5))
        descriptionField.tap()
        descriptionField.typeText("Keep this edit")
        app.segmentedControls.buttons["Completed"].tap()
        let creation = app.descendants(matching: .any).matching(identifier: "editor-created-at").firstMatch
        assertLocalCreationTime(creation)
        let originalDisplay = try XCTUnwrap(creation.value as? String)

        try await control("pause", body: [:])
        try await assertPendingSave(
            in: app,
            title: "Edit todo",
            creationValue: originalDisplay,
            method: "PUT",
            path: "/todos/existing-time",
            input: ["task": "Existing task", "description": "Keep this edit", "status": "completed", "dueAt": NSNull()]
        )
        try await control("fail", body: [:])
        let error = app.descendants(matching: .any).matching(identifier: "save-error").firstMatch
        XCTAssertTrue(error.waitForExistence(timeout: 5))
        XCTAssertEqual(descriptionField.value as? String, "Keep this edit")
        XCTAssertTrue(app.segmentedControls.buttons["Completed"].isSelected)
        assertLocalCreationTime(creation)
        XCTAssertTrue(app.buttons["Cancel"].isEnabled)
        XCTAssertTrue(app.buttons["save-todo"].isEnabled)
        let failedState = try await control("state", body: [:])
        XCTAssertEqual(failedState["todos"] as? NSArray, [original] as NSArray)

        app.buttons["Cancel"].tap()
        let row = app.cells.containing(.staticText, identifier: "Existing task").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Keep this edit"].exists)
        XCTAssertTrue(row.staticTexts["Incomplete"].exists)
        assertLocalCreationTime(row.descendants(matching: .any).matching(identifier: "list-created-at").firstMatch)
        edit.tap()
        XCTAssertTrue(descriptionField.waitForExistence(timeout: 5))
        XCTAssertNotEqual(descriptionField.value as? String, "Keep this edit")
        XCTAssertTrue(app.segmentedControls.buttons["Incomplete"].isSelected)
        assertLocalCreationTime(creation)
        app.buttons["Cancel"].tap()
    }

    func testOverdueDeadlineUsesLocalTimeAndOnlyRecoversAfterSave() async throws {
        try await control("reset", body: ["now": "2026-09-15T00:05:07Z", "todos": [[
            "id": "deadline",
            "task": "Deadline review",
            "description": "",
            "status": "overdue",
            "createdAt": "2026-09-14T00:05:06.123Z",
            "dueAt": "2026-09-15T00:05:06.123Z",
        ]]])
        let app = application()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_GB"]
        app.launchEnvironment["TZ"] = "America/Los_Angeles"
        app.launch()
        let row = app.cells.containing(.staticText, identifier: "Deadline review").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let due = row.descendants(matching: .any).matching(identifier: "list-due-at").firstMatch
        let created = row.descendants(matching: .any).matching(identifier: "list-created-at").firstMatch
        assertLocalCreationTime(due)
        XCTAssertGreaterThanOrEqual(due.frame.minX, created.frame.maxX)
        XCTAssertEqual(due.frame.minY, created.frame.minY, accuracy: 2)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Overdue with local deadline column"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        app.buttons["Edit Deadline review"].tap()
        let currentStatus = app.staticTexts["current-status"]
        XCTAssertTrue(currentStatus.waitForExistence(timeout: 5))
        XCTAssertEqual(currentStatus.label, "Overdue")
        XCTAssertFalse(app.segmentedControls.element.exists)
        XCTAssertTrue(app.datePickers["todo-due-at"].exists)
        let description = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        description.tap()
        description.typeText("Keep deadline precision")
        app.buttons["save-todo"].tap()
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.staticTexts["Overdue"].exists)
        let contentState = try await control("state", body: [:])
        let contentWrites = try XCTUnwrap(contentState["writes"] as? [[String: Any]])
        XCTAssertEqual(contentWrites.first?["body"] as? NSDictionary, [
            "task": "Deadline review", "description": "Keep deadline precision", "dueAt": "2026-09-15T00:05:06.123Z",
        ] as NSDictionary)

        app.buttons["Edit Deadline review"].tap()
        let enabled = app.switches["deadline-enabled"]
        XCTAssertTrue(enabled.waitForExistence(timeout: 5))
        enabled.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertEqual(enabled.value as? String, "0")
        XCTAssertEqual(currentStatus.label, "Overdue")
        XCTAssertFalse(app.segmentedControls.element.exists)
        app.buttons["save-todo"].tap()
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.staticTexts["Incomplete"].exists)
        XCTAssertEqual(due.value as? String, "No deadline")
        let recovered = try await control("state", body: [:])
        let writes = try XCTUnwrap(recovered["writes"] as? [[String: Any]])
        XCTAssertEqual(writes.last?["body"] as? NSDictionary, [
            "task": "Deadline review", "description": "Keep deadline precision", "dueAt": NSNull(),
        ] as NSDictionary)
        app.buttons["Edit Deadline review"].tap()
        XCTAssertTrue(app.segmentedControls.buttons["Completed"].waitForExistence(timeout: 5))
        app.segmentedControls.buttons["Completed"].tap()
        app.buttons["save-todo"].tap()
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.staticTexts["Completed"].exists)
    }

    func testPollingPreservesDraftAndSnapshotAndPausesInBackground() async throws {
        try await control("reset", body: ["now": "2026-09-15T12:00:00Z", "todos": [[
            "id": "polling", "task": "Polling review", "description": "", "status": "incomplete",
            "createdAt": "2026-09-14T09:00:00Z", "dueAt": "2026-09-15T12:01:00Z",
        ]]])
        let app = application()
        app.launch()
        let edit = app.buttons["Edit Polling review"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let description = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        XCTAssertTrue(description.waitForExistence(timeout: 5))
        description.tap()
        description.typeText("Keep during polling")
        app.segmentedControls.buttons["Completed"].tap()
        app.switches["deadline-enabled"].coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        try await control("clock", body: ["now": "2026-09-15T12:02:00Z"])
        XCTAssertTrue(app.staticTexts["current-status"].waitForExistence(timeout: 8))
        XCTAssertEqual(description.value as? String, "Keep during polling")
        XCTAssertEqual(app.switches["deadline-enabled"].value as? String, "0")
        XCTAssertFalse(app.segmentedControls.element.exists)
        app.buttons["Cancel"].tap()
        let row = app.cells.containing(.staticText, identifier: "Polling review").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        XCTAssertTrue(row.staticTexts["Overdue"].exists)

        try await control("fail-reads", body: [:])
        let refreshError = app.descendants(matching: .any).matching(identifier: "refresh-error").firstMatch
        XCTAssertTrue(refreshError.waitForExistence(timeout: 8))
        XCTAssertTrue(row.exists)
        XCTAssertTrue(app.buttons["New todo"].isEnabled)
        XCUIDevice.shared.press(.home)
        let background = try await control("state", body: [:])
        try await Task.sleep(for: .milliseconds(5500))
        let paused = try await control("state", body: [:])
        XCTAssertEqual(paused["reads"] as? Int, background["reads"] as? Int)
        try await control("release-reads", body: [:])
        app.activate()
        XCTAssertTrue(refreshError.waitForNonExistence(timeout: 5))
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        let resumed = try await control("state", body: [:])
        XCTAssertGreaterThan(try XCTUnwrap(resumed["reads"] as? Int), try XCTUnwrap(paused["reads"] as? Int))
    }

    func testConflictKeepsDraftAndOldPollsCannotOverwriteConflictOrSave() async throws {
        try await control("reset", body: ["now": "2026-09-15T12:00:00Z", "todos": [[
            "id": "conflict", "task": "Conflict review", "description": "", "status": "incomplete",
            "createdAt": "2026-09-14T09:00:00Z", "dueAt": "2026-09-15T12:01:00Z",
        ]]])
        let app = application()
        app.launch()
        let edit = app.buttons["Edit Conflict review"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let description = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        XCTAssertTrue(description.waitForExistence(timeout: 5))
        description.tap()
        description.typeText("Preserved conflict edit")
        app.segmentedControls.buttons["Completed"].tap()
        app.switches["deadline-enabled"].coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        try await control("pause-reads", body: [:])
        _ = try await waitForState { ($0["pendingReadCount"] as? Int) == 1 }
        try await control("clock", body: ["now": "2026-09-15T12:02:00Z"])
        app.buttons["save-todo"].tap()
        let failure = app.descendants(matching: .any).matching(identifier: "save-error").firstMatch
        XCTAssertTrue(failure.waitForExistence(timeout: 5))
        XCTAssertEqual(description.value as? String, "Preserved conflict edit")
        XCTAssertEqual(app.switches["deadline-enabled"].value as? String, "0")
        XCTAssertTrue(app.staticTexts["current-status"].exists)
        let conflicted = try await control("release-reads", body: ["mode": "fail"])
        let firstReads = try XCTUnwrap(conflicted["reads"] as? Int)
        _ = try await waitForState { ($0["reads"] as? Int ?? 0) > firstReads }
        XCTAssertTrue(app.staticTexts["current-status"].exists)
        XCTAssertFalse(app.segmentedControls.element.exists)

        try await control("pause-reads", body: [:])
        _ = try await waitForState { ($0["pendingReadCount"] as? Int) == 1 }
        app.buttons["save-todo"].tap()
        let row = app.cells.containing(.staticText, identifier: "Conflict review").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.staticTexts["Incomplete"].exists)
        let saved = try await control("release-reads", body: ["mode": "fail"])
        let savedReads = try XCTUnwrap(saved["reads"] as? Int)
        _ = try await waitForState { ($0["reads"] as? Int ?? 0) > savedReads }
        XCTAssertTrue(row.staticTexts["Incomplete"].exists)
        XCTAssertTrue(row.staticTexts["Preserved conflict edit"].exists)
        let writes = try XCTUnwrap(saved["writes"] as? [[String: Any]])
        XCTAssertEqual(writes.count, 2)
        XCTAssertEqual(writes[0]["body"] as? NSDictionary, [
            "task": "Conflict review", "description": "Preserved conflict edit", "status": "completed", "dueAt": NSNull(),
        ] as NSDictionary)
        XCTAssertEqual(writes[1]["body"] as? NSDictionary, [
            "task": "Conflict review", "description": "Preserved conflict edit", "dueAt": NSNull(),
        ] as NSDictionary)
    }

    func testDeletionConfirmsCancelsAndRemovesEveryStatus() async throws {
        let records: [[String: Any]] = ["incomplete", "completed", "overdue"].map { status in
            ["id": "delete-\(status)", "task": "Delete \(status)", "description": "Only this record",
             "status": status, "createdAt": "2026-09-15T09:00:00Z",
             "dueAt": status == "overdue" ? "2020-01-01T00:00:00Z" : NSNull()]
        }
        try await control("reset", body: ["todos": records])
        let app = application()
        app.launch()
        for record in records {
            let task = try XCTUnwrap(record["task"] as? String)
            let button = app.buttons["Delete \(task)"]
            XCTAssertTrue(button.waitForExistence(timeout: 10))
            button.tap()
            let confirmation = app.alerts["Delete todo?"]
            XCTAssertTrue(confirmation.waitForExistence(timeout: 5))
            XCTAssertTrue(confirmation.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", task)).firstMatch.exists)
            confirmation.buttons["Cancel"].tap()
            XCTAssertTrue(button.exists)
            button.tap()
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = "Delete confirmation \(task)"
            screenshot.lifetime = .keepAlways
            add(screenshot)
            confirmation.buttons["Delete todo"].tap()
            XCTAssertTrue(button.waitForNonExistence(timeout: 10))
        }
        XCTAssertTrue(app.staticTexts["No todos yet"].waitForExistence(timeout: 5))
        let state = try await control("state", body: [:])
        XCTAssertEqual((state["todos"] as? [Any])?.count, 0)
        let writes = try XCTUnwrap(state["writes"] as? [[String: Any]])
        XCTAssertEqual(writes.count, 3, "Canceling must not send a deletion")
        XCTAssertTrue(writes.allSatisfy { ($0["method"] as? String) == "DELETE" && $0["body"] is NSNull })
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["No todos yet"].waitForExistence(timeout: 10))
    }

    func testDeletionWaitsAndRetriesAfterFailure() async throws {
        try await control("reset", body: ["todos": [[
            "id": "delete-retry", "task": "Retry deletion", "description": "",
            "status": "incomplete", "createdAt": "2026-09-15T09:00:00Z", "dueAt": NSNull(),
        ]]])
        let app = application()
        app.launch()
        let button = app.buttons["Delete Retry deletion"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        try await control("pause", body: [:])
        button.tap()
        app.alerts["Delete todo?"].buttons["Delete todo"].tap()
        _ = try await waitForState { ($0["pendingCount"] as? Int) == 1 }
        XCTAssertFalse(button.isEnabled)
        XCTAssertEqual(button.value as? String, "Deleting")
        XCTAssertFalse(app.buttons["Edit Retry deletion"].isEnabled)
        button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let pending = try await control("state", body: [:])
        XCTAssertEqual((pending["writes"] as? [Any])?.count, 1)
        XCTAssertEqual((pending["todos"] as? [Any])?.count, 1)
        try await control("fail", body: [:])
        let failure = app.alerts["Could not delete todo"]
        XCTAssertTrue(failure.waitForExistence(timeout: 5))
        XCTAssertTrue(failure.buttons["Cancel"].exists)
        failure.buttons["Retry delete"].tap()
        XCTAssertTrue(app.staticTexts["No todos yet"].waitForExistence(timeout: 10))
        let saved = try await control("state", body: [:])
        XCTAssertEqual((saved["writes"] as? [Any])?.count, 2)
        XCTAssertEqual((saved["todos"] as? [Any])?.count, 0)
    }

    func testDeletionIgnoresLateSaveSuccess() async throws {
        try await assertDeletedDraftAfterLateSave(conflict: false)
    }

    func testDeletionIgnoresLateStatusConflict() async throws {
        try await assertDeletedDraftAfterLateSave(conflict: true)
    }

    func testDeletionNotFoundUpdatePreservesDraftAndRejectsOldPoll() async throws {
        try await control("reset", body: ["todos": [[
            "id": "deleted-update", "task": "Missing update", "description": "",
            "status": "incomplete", "createdAt": "2026-09-15T09:00:00Z", "dueAt": NSNull(),
        ]]])
        let app = application()
        app.launch()
        let edit = app.buttons["Edit Missing update"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let description = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        XCTAssertTrue(description.waitForExistence(timeout: 5))
        description.tap()
        description.typeText("Copy this missing draft")
        try await control("pause-reads", body: [:])
        _ = try await waitForState { ($0["pendingReadCount"] as? Int) == 1 }
        try await deleteFromAnotherClient("deleted-update")
        app.buttons["save-todo"].tap()
        let notice = app.descendants(matching: .any).matching(identifier: "deleted-notice").firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 8))
        XCTAssertFalse(app.buttons["save-todo"].isEnabled)
        XCTAssertEqual(app.staticTexts["deleted-description"].label, "Copy this missing draft")
        let released = try await control("release-reads", body: ["mode": "fail"])
        let reads = try XCTUnwrap(released["reads"] as? Int)
        _ = try await waitForState { ($0["reads"] as? Int ?? 0) > reads }
        XCTAssertTrue(notice.exists)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["No todos yet"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Edit Missing update"].exists)
    }

    private func assertDeletedDraftAfterLateSave(conflict: Bool) async throws {
        try await control("reset", body: ["now": "2026-09-15T12:00:00Z", "todos": [[
            "id": "late-delete", "task": "Deleted after save", "description": "",
            "status": "incomplete", "createdAt": "2026-09-14T09:00:00Z", "dueAt": "2026-09-15T12:01:00Z",
        ]]])
        let app = application()
        app.launch()
        let edit = app.buttons["Edit Deleted after save"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let description = app.descendants(matching: .any).matching(identifier: "todo-description").firstMatch
        XCTAssertTrue(description.waitForExistence(timeout: 5))
        description.tap()
        description.typeText("Keep this deleted draft")
        app.segmentedControls.buttons["Completed"].tap()
        app.switches["deadline-enabled"].coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        try await control("pause-reads", body: [:])
        _ = try await waitForState { ($0["pendingReadCount"] as? Int) == 1 }
        try await control("pause-write-results", body: [:])
        if conflict { try await control("clock", body: ["now": "2026-09-15T12:02:00Z"]) }
        app.buttons["save-todo"].tap()
        _ = try await waitForState { ($0["pendingWriteResultCount"] as? Int) == 1 }
        try await deleteFromAnotherClient("late-delete")
        try await control("release-reads", body: [:])
        let notice = app.descendants(matching: .any).matching(identifier: "deleted-notice").firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Cancel"].isEnabled)
        XCTAssertFalse(app.buttons["save-todo"].isEnabled)
        XCTAssertEqual(app.staticTexts["deleted-description"].label, "Keep this deleted draft")
        try await control("release-write-results", body: [:])
        let settled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: app.buttons["Cancel"])
        await fulfillment(of: [settled], timeout: 5)
        XCTAssertTrue(notice.exists)
        XCTAssertFalse(app.buttons["save-todo"].isEnabled)
        XCTAssertEqual(app.staticTexts["deleted-task"].label, "Deleted after save")
        XCTAssertEqual(app.staticTexts["deleted-description"].label, "Keep this deleted draft")
        XCTAssertEqual(app.switches["deadline-enabled"].value as? String, "0")
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = conflict ? "Deleted draft after late conflict" : "Deleted draft after late save"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["No todos yet"].waitForExistence(timeout: 5))
        app.buttons["New todo"].tap()
        let newTask = app.descendants(matching: .any).matching(identifier: "todo-task").firstMatch
        XCTAssertTrue(newTask.waitForExistence(timeout: 5))
        XCTAssertNotEqual(newTask.value as? String, "Deleted after save")
        app.buttons["Cancel"].tap()
    }

    private func deleteFromAnotherClient(_ id: String) async throws {
        let address = try XCTUnwrap(ProcessInfo.processInfo.environment["TODO_UI_TEST_API_URL"])
        let baseURL = try XCTUnwrap(URL(string: address))
        var request = URLRequest(url: baseURL.appending(component: "todos").appending(component: id))
        request.httpMethod = "DELETE"
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 204)
        XCTAssertTrue(data.isEmpty)
    }

    private func assertPendingSave(
        in app: XCUIApplication,
        title: String,
        creationValue: String,
        method: String,
        path: String,
        input: [String: Any]
    ) async throws {
        let save = app.buttons["save-todo"]
        let cancel = app.buttons["Cancel"]
        save.tap()
        XCTAssertFalse(save.isEnabled)
        XCTAssertFalse(cancel.isEnabled)
        let selectedStatus = input["status"] as? String == "completed" ? "Completed" : "Incomplete"
        let otherStatus = selectedStatus == "Completed" ? "Incomplete" : "Completed"
        app.segmentedControls.buttons[otherStatus].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.segmentedControls.buttons[selectedStatus].isSelected)
        let creation = app.descendants(matching: .any).matching(identifier: "editor-created-at").firstMatch
        XCTAssertEqual(creation.value as? String, creationValue)

        save.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        cancel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        let dragStart = app.navigationBars[title].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
        dragStart.press(forDuration: 0.1, thenDragTo: dragStart.withOffset(CGVector(dx: 0, dy: 400)))
        XCTAssertTrue(creation.exists)
        XCTAssertFalse(save.isEnabled)
        let state = try await control("state", body: [:])
        XCTAssertEqual(state["pendingCount"] as? Int, 1)
        let writes = try XCTUnwrap(state["writes"] as? [[String: Any]])
        XCTAssertEqual(writes.count, 1, "A pending save must not submit twice")
        XCTAssertEqual(writes.first?["method"] as? String, method)
        XCTAssertEqual(writes.first?["path"] as? String, path)
        XCTAssertEqual(writes.first?["body"] as? NSDictionary, input as NSDictionary)
    }

    private func waitForState(_ matches: ([String: Any]) -> Bool) async throws -> [String: Any] {
        let deadline = ContinuousClock.now.advanced(by: .seconds(8))
        while ContinuousClock.now < deadline {
            let state = try await control("state", body: [:])
            if matches(state) { return state }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTFail("The expected service request did not arrive.")
        throw URLError(.timedOut)
    }

    private func application() -> XCUIApplication {
        let app = XCUIApplication()
        if let endpoint = ProcessInfo.processInfo.environment["TODO_UI_TEST_API_URL"] {
            app.launchEnvironment["TODO_API_BASE_URL"] = endpoint
        }
        return app
    }

    @discardableResult
    private func control(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        let address = try XCTUnwrap(
            ProcessInfo.processInfo.environment["TODO_UI_TEST_API_URL"],
            "Run node src/ios/test-ui.mjs to start the isolated test API."
        )
        let baseURL = try XCTUnwrap(URL(string: address))
        var request = URLRequest(url: baseURL.appending(path: "__test/\(path)"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func assertLocalCreationTime(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        let displayed = element.value as? String ?? ""
        XCTAssertNotNil(displayed.range(of: #"^14 Sept? 2026\b"#, options: .regularExpression), "Unexpected local date: \(displayed)", file: file, line: line)
        XCTAssertTrue(displayed.hasSuffix("17:05"), "Unexpected local time: \(displayed)", file: file, line: line)
    }
}