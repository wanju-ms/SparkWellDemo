# Todo API

Node.js 24+ and Express implement the [shared Todo contract](../contracts/todo-api.yaml).
See [Todo Service](../../artifacts/sparks/todo-service.md) for the accepted
demo lifecycle and deferred durable-storage requirement.

From this directory:

```sh
npm ci
npm run check
npm test
npm run dev
```

Use `npm start` without file watching. The default address is
`http://127.0.0.1:3000`; `HOST` and `PORT` override it.

The API exposes `GET /todos`, `POST /todos`, `PUT /todos/{id}`, and `DELETE /todos/{id}`.
Deletion returns `204` without a body, including when the ID is already absent.
Other responses and write inputs use JSON. Field semantics, status values, and responses are defined in
the contract. Text limits count grapheme clusters, including combined emoji;
the server reads those limits from the contract and validates every write.

Browser access defaults to HTTP origins on localhost or 127.0.0.1. Set
`CORS_ORIGINS` to a comma-separated list of exact origins when using other local
development addresses. The service has no authentication and is not intended
for public deployment.

Each process starts with an empty collection. Closing a client does not reset
server data; restarting the server, including a watch-mode restart, does.
Tests run isolated service instances and cover success, limits, invalid input,
read/write failures, missing IDs, and fresh-instance state.