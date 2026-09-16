---
id: todo-expiration-monitor
description: "Independently scans saved Todos and requests overdue transitions while the service is running."
kind: spark
spark-type: service
uses: [todo-service]
---

# Todo Expiration Monitor

- Start a scan immediately on startup, then scan every 5 seconds while running.
  Checking continues without HTTP requests or connected clients. Do not overlap
  scans; retry failed scans or individual transitions on a subsequent scan.
- Obtain candidate IDs through [Todo Service](todo-service.md)'s
  `overdueCandidates` capability, then invoke `markOverdue` for each candidate.
  The service supplies the saved values and authoritative clock; this monitor
  does not maintain another Todo collection.
- Stop scheduling on shutdown. In the current demo, the monitor runs alongside
  the HTTP API in the same Node.js process with a distinct start/stop lifecycle.
  It does not keep running when that process is stopped.

The scan interval is a scheduling cadence, not an exact deadline for visible
changes. [Todo Expiration Sync](../collaborations/todo-expiration-sync.md) describes
how committed transitions reach polling clients and interact with editing.