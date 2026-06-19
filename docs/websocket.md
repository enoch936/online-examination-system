# WebSocket Architecture

Namespace: `/realtime`

## Events

| Event | Direction | Purpose |
| --- | --- | --- |
| `notifications:subscribe` | client to server | Join user notification channel |
| `exam:join` | client to server | Join candidate exam session room |
| `exam:heartbeat` | client to server | Maintain live session state |
| `exam:violation` | client to server | Log focus, fullscreen, tab, or activity violations |
| `monitor:join` | client to server | Instructor/admin joins exam monitoring room |
| `monitor:candidate-update` | server to client | Broadcast candidate activity state |
| `notification:new` | server to client | Deliver realtime notification |

Production multi-node deployments should enable the Socket.IO Redis adapter.
