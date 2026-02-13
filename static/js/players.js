/* ============================================
   Players Manager - Roleta Casino
   Handles real-time player bet display
   ============================================ */

class PlayersManager {
    constructor() {
        this.panels = {
            red: null,
            white: null,
            black: null
        };

        this.players = {
            red: [],
            white: [],
            black: []
        };
    }

    /**
     * Initialize DOM references
     */
    init() {
        this.panels.red = document.getElementById('redPlayers');
        this.panels.white = document.getElementById('whitePlayers');
        this.panels.black = document.getElementById('blackPlayers');

        // Show empty state initially
        ['red', 'white', 'black'].forEach(color => this._renderEmpty(color));
    }

    /**
     * Add a player bet to a color panel
     */
    addPlayer(color, player) {
        // Check if player already bet on this color (update amount)
        const existing = this.players[color].find(p => p.id === player.id);
        if (existing) {
            existing.amount += player.amount;
        } else {
            this.players[color].push(player);
        }

        // Sort by amount descending
        this.players[color].sort((a, b) => b.amount - a.amount);

        this._renderPanel(color);
        this._updatePanelInfo(color);
    }

    /**
     * Clear all players for new round
     */
    clearAll() {
        ['red', 'white', 'black'].forEach(color => {
            this.players[color] = [];
            this._renderEmpty(color);
            this._updatePanelInfo(color);
        });
    }

    /**
     * Get total bet amount for a color
     */
    getTotalForColor(color) {
        return this.players[color].reduce((sum, p) => sum + p.amount, 0);
    }

    /* ── Rendering ── */

    _renderPanel(color) {
        const panel = this.panels[color];
        if (!panel) return;

        panel.innerHTML = '';

        if (this.players[color].length === 0) {
            this._renderEmpty(color);
            return;
        }

        this.players[color].forEach((player, index) => {
            const entry = this._createPlayerEntry(player, index);
            panel.appendChild(entry);
        });
    }

    _createPlayerEntry(player, index) {
        const entry = document.createElement('div');
        entry.className = `player-entry${player.isSelf ? ' player-entry--self' : ''}`;

        const avatarSrc = player.avatar || this._getDefaultAvatar(player.username);
        const levelClass = this._getLevelClass(player.level);

        entry.innerHTML = `
            <div class="player-entry__left">
                <div class="player-entry__avatar">
                    <img src="${this._escapeAttr(avatarSrc)}" alt="${this._escapeAttr(player.username)}" loading="lazy">
                </div>
                <span class="player-entry__level ${levelClass}">${player.level}</span>
                <span class="player-entry__name">${this._escapeHtml(player.username)}</span>
            </div>
            <div class="player-entry__amount">${player.amount.toFixed(2)}</div>
        `;

        return entry;
    }

    _renderEmpty(color) {
        const panel = this.panels[color];
        if (!panel) return;

        panel.innerHTML = `
            <div class="panel__players-empty">
                <i class="fas fa-users"></i>
                <p>Nenhuma aposta ainda</p>
            </div>
        `;
    }

    _updatePanelInfo(color) {
        const count = this.players[color].length;
        const total = this.players[color].reduce((sum, p) => sum + p.amount, 0);

        const countEl = document.getElementById(`${color}BetsCount`);
        const totalEl = document.getElementById(`${color}BetsTotal`);

        if (countEl) countEl.textContent = count;
        if (totalEl) totalEl.textContent = total.toFixed(2);
    }

    /* ── Helpers ── */

    _getLevelClass(level) {
        if (level >= 80) return 'level--legendary';
        if (level >= 60) return 'level--epic';
        if (level >= 40) return 'level--rare';
        if (level >= 20) return 'level--uncommon';
        return 'level--common';
    }

    _getDefaultAvatar(username) {
        const colors = ['e74c3c', '3498db', '2ecc71', 'f39c12', '9b59b6', '1abc9c', 'e67e22', '16a085'];
        const charCode = (username || 'U').charCodeAt(0);
        const colorIndex = charCode % colors.length;
        const initials = (username || 'U').substring(0, 2).toUpperCase();
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${colors[colorIndex]}&color=fff&size=40&bold=true&format=svg`;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    _escapeAttr(text) {
        return (text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

const playersManager = new PlayersManager();
