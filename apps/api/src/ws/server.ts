import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { wsEventSchema, type WsEvent } from '@printfarm/shared/ws-events'
import { WS_PING_INTERVAL_MS } from '@printfarm/shared/constants'

type TenantConnection = {
  ws: WebSocket
  tenantId: string
  userId: string
  isAlive: boolean
}

const connections = new Map<string, Set<TenantConnection>>()

function addConnection(conn: TenantConnection) {
  const existing = connections.get(conn.tenantId) ?? new Set()
  existing.add(conn)
  connections.set(conn.tenantId, existing)
}

function removeConnection(conn: TenantConnection) {
  const tenantConns = connections.get(conn.tenantId)
  if (tenantConns) {
    tenantConns.delete(conn)
    if (tenantConns.size === 0) connections.delete(conn.tenantId)
  }
}

export function broadcastToTenant(tenantId: string, event: WsEvent) {
  const tenantConns = connections.get(tenantId)
  if (!tenantConns) return

  const payload = JSON.stringify(event)

  for (const conn of tenantConns) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(payload)
    }
  }
}

export function createWsServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  const pingInterval = setInterval(() => {
    for (const tenantConns of connections.values()) {
      for (const conn of tenantConns) {
        if (!conn.isAlive) {
          conn.ws.terminate()
          removeConnection(conn)
          continue
        }
        conn.isAlive = false
        conn.ws.ping()
      }
    }
  }, WS_PING_INTERVAL_MS)

  wss.on('connection', (ws: WebSocket, req: import('node:http').IncomingMessage) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const tenantId = url.searchParams.get('tenantId')
    const userId = url.searchParams.get('userId')

    if (!tenantId || !userId) {
      ws.close(4001, 'tenantId i userId su obavezni')
      return
    }

    const conn: TenantConnection = { ws, tenantId, userId, isAlive: true }
    addConnection(conn)

    ws.on('pong', () => { conn.isAlive = true })

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString())
        const parsed = wsEventSchema.safeParse(data)
        if (!parsed.success) return
      } catch {
        // Ignorišemo invalid poruke
      }
    })

    ws.on('close', () => removeConnection(conn))
    ws.on('error', () => {
      removeConnection(conn)
      ws.terminate()
    })

    ws.send(JSON.stringify({ type: 'connected', tenantId }))
  })

  wss.on('close', () => clearInterval(pingInterval))

  return wss
}
