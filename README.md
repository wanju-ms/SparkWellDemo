# SparkWell Demo

A workspace for maintaining one current software model with people and AI.
Artifacts preserve software concepts, local intent, scoped commitments,
cross-cutting concerns, and concrete collaborations.

- [Overview](.sparkwell/sparkwell-overview.md)
- [Design Modeling Guide](.sparkwell/design-modeling-guide.md)
- [Artifact Document Specification](.sparkwell/artifact-document-spec.md)
- [Implementation Configuration](.sparkwell/implementation-config.md)
- [Implementation Map](.sparkwell/implementation-map.md)
- [Tools](.sparkwell/tools.md)
- [Artifact Index](artifacts/index.md)

Use [Spark Design](.github/skills/spark-design/SKILL.md) with a requirement,
design question, or selected model or code changes:

```text
/spark-design
Describe the desired behavior, design question, or changes to review.
```

The Skill proposes model updates, waits for confirmation, and then maintains the
affected artifacts and index. It resolves applicable rules and collaborations
from current files without a persistent reverse index. It does not modify
application code; implementation is separately authorized work.

## Implement the Model

Use [Spark Implementation](.github/skills/spark-impl/SKILL.md) to create or update
code from the accepted model and [implementation configuration](.sparkwell/implementation-config.md).
Specify Spark, binding, or implementation IDs, or identify the changes to implement.
For example, with matching model and configuration IDs:

```text
/spark-impl
Implement todo-editor using web-ui.
```

The Skill resolves the necessary scope, reuses existing outputs, verifies changed
behavior, and maintains implementation maps. It raises design issues for review
instead of bypassing the model, and does not regenerate the whole graph by default.

## Tool Prerequisites

The implementation tools require **Node.js 24 or later** and **npm** in the
environment where the agent runs commands. From the project root, install their
dependencies with:

```sh
npm ci --prefix .sparkwell/tools
```

This is a development-tool requirement, not a requirement for generated
applications. Python is not required. See [Tools](.sparkwell/tools.md) for commands
and tests.

## Run the Todo Demo

The React and native SwiftUI apps use the same Node.js service and
[OpenAPI contract](src/contracts/todo-api.yaml). The server holds the demo's
authoritative data in memory; restarting the server clears it. Durable storage
remains deferred as recorded in [Todo Service](artifacts/sparks/todo-service.md).

Install the application and contract-tool dependencies from the project root:

```sh
npm ci --prefix src/api
npm ci --prefix src/contracts
npm ci --prefix src/web
```

Start the API and Web app in separate terminals:

```sh
npm start --prefix src/api
```

```sh
npm run dev --prefix src/web
```

The API defaults to `http://127.0.0.1:3000`; Vite prints the Web URL, normally
`http://localhost:5173`. Set `VITE_API_BASE_URL` when starting Vite to use another
server. The UI and both clients load real server data, not local-storage mocks.

Starting the API also starts an independent in-process expiration worker: it scans
immediately and every five seconds, and stops with the server. It uses the Todo
service's data and clock without HTTP calls. Web and iOS refresh every five seconds
while foreground, pause in background, and refresh on return. Failed refreshes keep
the last snapshot; refreshed or conflicting records do not replace editor drafts.

`dueAt` is optional and nullable. Both editors use local date and time and submit
UTC. Only the service sets `overdue`; completed items stay completed. An overdue
item keeps its read-only status until a cleared or future deadline is saved, then
returns to incomplete. A stale manual-status update returns `409` with the current
record so the editor can preserve the draft and retry without a manual status.

Open [src/ios/TodoApp.xcodeproj](src/ios/TodoApp.xcodeproj) in Xcode and run the
TodoApp scheme on an iOS 26.5+ simulator. The existing project's deployment
target is retained. The app links the local [Swift client package](src/ios/client/Package.swift).
Its `TODO_API_BASE_URL` build setting defaults to the API above; a scheme
environment variable with the same name overrides it at launch. For a physical
device, use the Mac's reachable LAN address, start the API with `HOST=0.0.0.0`,
and allow local-network access. Signing requires your own development team.
The unauthenticated demo server is intended for local development only.

## Check the Demo

```sh
npm test --prefix src/api
npm test --prefix src/web
npm run build --prefix src/web
npm run lint --prefix src/web
npm exec --prefix src/web -- playwright install chromium
npm run test:e2e --prefix src/web
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --package-path src/ios/client --scratch-path src/ios/.build/client-tests
node src/ios/test-ui.mjs
```

Playwright starts isolated API and Web servers on ports 43100 and 45173. The
Swift live-service test is opt-in: set `TODO_TEST_API_URL` to a disposable running
API when invoking `swift test`; it creates and updates records there. Without
that variable, the data and encoding tests run and the live test is skipped.

The [native UI test runner](src/ios/test-ui.mjs) starts an isolated instance of
the real API on an available port and closes it after testing. Test-only controls
seed records, set the service clock, capture writes, and hold or fail requests;
they are not part of the application server. The suite checks local date columns,
deadline recovery, foreground polling, stale-response rejection, retained drafts,
read-only status, pending-save guards, failure recovery, cancellation, and reload.

The runner forwards its endpoint through `TEST_RUNNER_TODO_UI_TEST_API_URL` to
XCTest, which sets `TODO_API_BASE_URL` in each app's launch environment. It does
not override the app's build-time default address or use the running demo's data.
Date tests set their own launch locale and time zone. Use this runner for the
controlled scenarios; it accepts `xcodebuild` test filters such as `-only-testing`.
Set `IOS_TEST_DESTINATION` to select another installed simulator. The default is
`platform=iOS Simulator,name=iPhone 17 Pro`.

`npm run generate:client --prefix src/web` regenerates the TypeScript schema
from OpenAPI; the Web build also does this. The contract generator uses its own
TypeScript toolchain, separate from the Web app's existing TypeScript 6 compiler.
The Swift Codable client follows the same contract and is checked against the
real API. Contract changes should update both clients and their tests.
