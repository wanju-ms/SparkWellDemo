# Todo Web

React and TypeScript implement [Todo App](../../artifacts/sparks/todo-app.md)
and [Todo Editor](../../artifacts/sparks/todo-editor.md). The existing Vite and
Oxlint setup is retained; React Compiler is not enabled.

Follow the [root setup instructions](../../README.md) to install the API,
contract tooling, and Web dependencies, then start the API. From this directory:

```sh
npm run dev
```

`VITE_API_BASE_URL` selects the API, defaulting to `http://127.0.0.1:3000`.
The browser calls the server through the typed [client](client/todo-client.ts).
The [schema types](client/schema.d.ts) are generated from
[OpenAPI](../contracts/todo-api.yaml); do not edit them manually.

```sh
npm run generate:client
npm test
npm run build
npm run lint
npm run test:e2e
```

Client tests use an isolated real API. Playwright covers desktop and mobile
viewports, real saves and reloads, modal cancellation, inclusive field limits,
load failures, and draft retention after failed saves. Install Chromium using
`npm exec -- playwright install chromium` before the first browser test run.
