# Artifacts

| ID | Kind | Spark Type | Description | Link |
| --- | --- | --- | --- | --- |
| todo-app | spark | ui | Lists Todos with their time fields and coordinates editing and foreground refresh. | [Todo App](sparks/todo-app.md) |
| todo-editor | spark | ui | Edits Todo content and deadlines in a modal while keeping system state and unsaved input separate. | [Todo Editor](sparks/todo-editor.md) |
| todo-expiration-monitor | spark | service | Independently scans saved Todos and requests overdue transitions while the service is running. | [Todo Expiration Monitor](sparks/todo-expiration-monitor.md) |
| todo-expiration-sync | collaboration | | Coordinates overdue monitoring, atomic transitions, polling, and editor conflict recovery. | [Todo Expiration Sync](collaborations/todo-expiration-sync.md) |
| todo-item | spark | data | Defines Todo fields, stable identity, validity rules, and deadline-based status transitions. | [Todo Item](sparks/todo-item.md) |
| todo-service | spark | service | Loads and saves Todos and provides atomic status transitions for client requests and background checks. | [Todo Service](sparks/todo-service.md) |