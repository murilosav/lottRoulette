/* ============================================
   WebSocket Manager - Roleta Casino
   Prepared for Django Channels integration

   Expected server message format:
   {
       "type": "event_name",
       "payload": { ... }
   }

   Events:
   - round_start: { round_id, betting_time }
   - bet_placed: { color, player: { id, username, avatar, level, amount } }
   - betting_closed: {}
   - spin: { round_id, winning_number }
   - round_result: { round_id, winning_number, winning_color }
   - balance_update: { balance }
   - error: { message }
   ============================================ */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.url = `${CONFIG.WS_BASE_URL}/roulette/`;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 15;
        this.baseReconnectDelay = 1000;
        this.isConnected = false;
        this.intentionalClose = false;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        if (CONFIG.DEMO_MODE) {
            console.log('[WS] Demo mode — WebSocket disabled');
            return;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WS] Already connected');
            return;
        }

        this.intentionalClose = false;

        try {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => this._onOpen();
            this.ws.onmessage = (e) => this._onMessage(e);
            this.ws.onclose = (e) => this._onClose(e);
            this.ws.onerror = (e) => this._onError(e);
        } catch (error) {
            console.error('[WS] Connection error:', error);
            this._tryReconnect();
        }
    }

    /**
     * Send message to server
     */
    send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[WS] Not connected, cannot send:', type);
            return false;
        }

        this.ws.send(JSON.stringify({ type, payload }));
        return true;
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Disconnect intentionally
     */
    disconnect() {
        this.intentionalClose = true;
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
    }

    /* ── Internal Handlers ── */

    _onOpen() {
        console.log('[WS] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._emit('connected');
    }

    _onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.type) {
                this._emit(data.type, data.payload);
            }
        } catch (error) {
            console.error('[WS] Parse error:', error);
        }
    }

    _onClose(event) {
        this.isConnected = false;
        console.log(`[WS] Disconnected (code: ${event.code})`);
        this._emit('disconnected', { code: event.code });

        if (!this.intentionalClose) {
            this._tryReconnect();
        }
    }

    _onError(error) {
        console.error('[WS] Error:', error);
    }

    _tryReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WS] Max reconnection attempts reached');
            this._emit('reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            30000
        );

        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[WS] Listener error for "${event}":`, error);
                }
            });
        }
    }
}

const wsManager = new WebSocketManager();
