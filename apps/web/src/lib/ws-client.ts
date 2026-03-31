import type { WsEnvelope } from '@printfarm/shared/ws-events'
import { tokenStorage } from './api-client'

const WS_URL = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000') as string

type MessageHandler = (envelope: WsEnvelope) => void
type StatusHandler = (status: 'connected' | 'disconnected' | 'error') => void

export class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true

  connect() {
    const token = tokenStorage.get()
    if (!token) return

    this.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)

    this.ws.onopen = () => {
      this.notifyStatus('connected')
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as WsEnvelope
        this.handlers.forEach(h => h(envelope))
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.notifyStatus('disconnected')
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }
    }

    this.ws.onerror = () => {
      this.notifyStatus('error')
    }
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  private notifyStatus(status: 'connected' | 'disconnected' | 'error') {
    this.statusHandlers.forEach(h => h(status))
  }
}

export const wsClient = new WsClient()
