# SparkWell Demo

A Todo demo exploring how people and AI can maintain shared Spark design and
use it to implement and evolve Web and native iOS applications.

## Start Here

- [Brief version (Chinese)](SparkWell：AI%20Coding%20时代的软件工程方法思考%20（极简版）.md): the idea and why it matters.
- [Method and Todo walkthrough (Chinese)](SparkWell：AI%20Coding%20时代的软件工程方法思考.md): the reasoning, concrete examples, and questions for review.
- [Artifact Index](artifacts/index.md): the Demo's current design and behavior.

## Run the Todo Demo

Requires **Node.js 24+ and npm**. The React and SwiftUI apps share a Node.js service
and [OpenAPI contract](src/contracts/todo-api.yaml). Data is held in server memory
and lost on server restart; durable storage remains deferred. The service has no
authentication and is intended for local development only.

Run all commands from the project root. Install dependencies:

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
server. More details: [API](src/api/README.md) and [Web](src/web/README.md).

### iOS

Open [src/ios/TodoApp.xcodeproj](src/ios/TodoApp.xcodeproj) in Xcode and run the
TodoApp scheme on an iOS 26.5+ simulator. The app links the local
[Swift client package](src/ios/client/Package.swift) and uses the API address above.
Override it with the `TODO_API_BASE_URL` scheme environment variable.

For a physical device, use the Mac's reachable LAN address, start the API with
`HOST=0.0.0.0`, and allow local-network access. Signing requires your own
development team.

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

Web and native UI tests start isolated APIs. The [iOS runner](src/ios/test-ui.mjs)
defaults to the iPhone 17 Pro simulator; set `IOS_TEST_DESTINATION` to use another
installed simulator. Swift live-service tests are optional: set `TODO_TEST_API_URL`
to a disposable API when running `swift test`; those tests write data there.

## Work with Sparks

Install the SparkWell tools' dependencies before using the implementation or QA Skills:

```sh
npm ci --prefix .sparkwell/tools
```

- [Spark Design](.github/skills/spark-design/SKILL.md): use `/spark-design` to discuss a requirement or change, then confirm the design before updating Artifacts.
- [Spark Implementation](.github/skills/spark-impl/SKILL.md): use `/spark-impl` to implement the selected, confirmed design, reuse existing code, and verify changes.
- [Spark QA](.github/skills/spark-qa/SKILL.md): use `/spark-qa` to create or update human-readable manual test cases by platform and business workflow, with the requested coverage and execution budget. It does not run tests.

Reference material:

- [Overview](.sparkwell/sparkwell-overview.md), [Modeling Guide](.sparkwell/design-modeling-guide.md), and [Artifact Specification](.sparkwell/artifact-document-spec.md).
- [Implementation Configuration](.sparkwell/implementation-config.md) and [Implementation Map](.sparkwell/implementation-map.md).
- [Tools and Checks](.sparkwell/tools.md).
