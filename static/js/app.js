/* ============================================
   Main Application - Roleta Casino
   Orchestrates all components and manages state
   ============================================ */

class App {
    constructor() {
        this.userBalance = 0;
        this.userProfile = null;
        this.previousRolls = [];
        this.rollsStats = { red: 0, white: 0, black: 0 };
        this.soundEnabled = true;
        this.demoRoundTimeout = null;
    }

    /**
     * Initialize the entire application
     */
    async init() {
        console.log('🎰 Roleta Casino — Initializing...');

        // Initialize components
        rouletteEngine.init();
        bettingManager.init();
        playersManager.init();
        casinoWheel.init();
        chipManager.init();

        // Setup UI interactions
        this._setupProfileDropdown();
        this._setupSoundToggle();
        this._setupLivestreamToggle();
        this._setupViewToggle();
        this._setupTableBetting();

        // Connect to backend or start demo
        if (CONFIG.DEMO_MODE) {
            this._initDemoMode();
        } else {
            wsManager.connect();
            this._setupWebSocketListeners();
            await this._loadInitialData();
        }

        console.log('🎰 Roleta Casino — Ready!');
    }

    /* ═══════════════════════════════════════════
       UI Setup
       ═══════════════════════════════════════════ */

    _setupViewToggle() {
        const toggleContainer = document.getElementById('viewToggle');
        if (!toggleContainer) return;

        const btns = toggleContainer.querySelectorAll('.view-toggle__btn');
        const modernView = document.getElementById('bettingPanels');
        const classicView = document.getElementById('classicView');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;

                // Update active button
                btns.forEach(b => b.classList.remove('view-toggle__btn--active'));
                btn.classList.add('view-toggle__btn--active');

                // Toggle views
                if (view === 'modern') {
                    modernView.classList.add('betting-view--active');
                    classicView.classList.remove('betting-view--active');
                } else {
                    modernView.classList.remove('betting-view--active');
                    classicView.classList.add('betting-view--active');
                }
            });
        });
    }

    _setupTableBetting() {
        const table = document.getElementById('rouletteTable');
        if (!table) return;

        table.addEventListener('click', (e) => {
            const cell = e.target.closest('.table__cell');
            if (!cell || cell.classList.contains('table__cell--outside-spacer')) return;

            const betType = cell.dataset.betType;
            if (!betType) return;

            if (bettingManager.isLocked || rouletteEngine.state !== 'betting') {
                showToast('Aguarde a próxima rodada para apostar!', 'error');
                return;
            }

            const amount = bettingManager.betAmount;
            if (amount <= 0) {
                showToast('Insira um valor para apostar!', 'warning');
                return;
            }

            const balance = this.userBalance;
            if (amount > balance) {
                showToast('Saldo insuficiente!', 'error');
                return;
            }

            // Determine what color/bet to place
            let color = null;
            if (betType === 'straight') {
                const num = parseInt(cell.dataset.number);
                color = CONFIG.ROULETTE.NUMBERS[num];
            } else if (betType === 'color') {
                color = cell.dataset.color;
            } else if (betType === 'parity') {
                // Odd/Even maps to a color group for simplicity; placed as red or black
                // Odd: 1,3,5,7,9,11,13 | Even: 2,4,6,8,10,12,14
                color = cell.dataset.parity === 'odd' ? 'red' : 'black';
            }

            if (color) {
                bettingManager.placeBet(color);
                this._placeChipOnCell(cell, amount);
            }
        });
    }

    _placeChipOnCell(cell, amount) {
        // Remove existing chip on this cell
        const existing = cell.querySelector('.table__chip');
        if (existing) existing.remove();

        const chip = document.createElement('div');
        chip.className = 'table__chip table__chip--self';

        // Format chip label
        let label;
        if (amount >= 1000) label = (amount / 1000).toFixed(1) + 'k';
        else if (amount >= 1) label = amount.toFixed(0);
        else label = amount.toFixed(2);
        chip.textContent = label;

        cell.classList.add('table__cell--has-bet');
        cell.appendChild(chip);
    }

    clearTableChips() {
        const table = document.getElementById('rouletteTable');
        if (!table) return;
        table.querySelectorAll('.table__chip').forEach(c => c.remove());
        table.querySelectorAll('.table__cell--has-bet').forEach(c => c.classList.remove('table__cell--has-bet'));
    }

    _setupProfileDropdown() {
        const trigger = document.getElementById('profileTrigger');
        const dropdown = document.getElementById('profileDropdown');

        if (!trigger || !dropdown) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('profile__dropdown--active');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('profile__dropdown--active');
            }
        });
    }

    _setupSoundToggle() {
        const btn = document.getElementById('soundToggle');
        const icon = document.getElementById('soundIcon');

        if (!btn) return;

        btn.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            icon.className = this.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
            rouletteEngine.soundEnabled = this.soundEnabled;
        });
    }

    _setupLivestreamToggle() {
        const toggle = document.getElementById('livestreamToggle');
        const livestream = document.getElementById('livestream');

        if (!toggle || !livestream) return;

        toggle.addEventListener('click', () => {
            livestream.classList.toggle('livestream--collapsed');
        });

        // Fullscreen button
        const fsBtn = document.getElementById('fullscreenBtn');
        const embed = document.getElementById('livestreamEmbed');
        if (fsBtn && embed) {
            fsBtn.addEventListener('click', () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    embed.requestFullscreen().catch(() => {});
                }
            });
        }

        // Simulate viewer count changes in demo mode
        if (CONFIG.DEMO_MODE) {
            this._simulateViewerCount();
        }
    }

    /* ═══════════════════════════════════════════
       WebSocket Integration (Real Backend)
       ═══════════════════════════════════════════ */

    _setupWebSocketListeners() {
        // New round started
        wsManager.on('round_start', (data) => {
            playersManager.clearAll();
            this.clearTableChips();
            bettingManager.unlock();
            rouletteEngine.startBetting(data.betting_time || CONFIG.BETTING.BETTING_TIME);
        });

        // Another player placed a bet
        wsManager.on('bet_placed', (data) => {
            if (data.player && data.color) {
                playersManager.addPlayer(data.color, data.player);
            }
        });

        // Betting phase closed
        wsManager.on('betting_closed', () => {
            bettingManager.lock();
        });

        // Spin the wheel
        wsManager.on('spin', async (data) => {
            bettingManager.lock();
            casinoWheel.spin(data.winning_number);
            const result = await rouletteEngine.spin(data.winning_number);
            bettingManager.processResult(result.color);
            this.addPreviousRoll(result);
        });

        // Balance updated from server
        wsManager.on('balance_update', (data) => {
            if (data.balance !== undefined) {
                this.updateBalance(data.balance);
            }
        });

        // Error from server
        wsManager.on('error', (data) => {
            showToast(data.message || 'Erro do servidor', 'error');
        });

        // Connection status
        wsManager.on('connected', () => {
            showToast('Conectado ao servidor', 'success');
        });

        wsManager.on('disconnected', () => {
            showToast('Conexão perdida. Reconectando...', 'warning');
        });

        wsManager.on('reconnect_failed', () => {
            showToast('Não foi possível reconectar. Recarregue a página.', 'error');
        });
    }

    /**
     * Load initial data from REST API
     */
    async _loadInitialData() {
        try {
            const [profile, balanceData, history] = await Promise.all([
                api.getProfile(),
                api.getBalance(),
                api.getHistory(),
            ]);

            this.setProfile(profile);
            this.updateBalance(balanceData.balance || balanceData.amount || 0);

            if (history && history.results) {
                history.results.forEach(roll => {
                    this.addPreviousRoll({
                        number: roll.winning_number,
                        color: CONFIG.ROULETTE.NUMBERS[roll.winning_number]
                    });
                });
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
            showToast('Erro ao carregar dados do servidor', 'error');
        }
    }

    /* ═══════════════════════════════════════════
       Demo Mode
       ═══════════════════════════════════════════ */

    _initDemoMode() {
        console.log('🎲 Demo mode active');

        // Set demo profile
        this.setProfile({
            username: 'Jogador_Demo',
            avatar: null,
            level: 42
        });
        this.updateBalance(5000.00);

        // Generate some previous roll history
        this._generateDemoHistory();

        // Start the game loop
        this._startDemoRound();
    }

    _generateDemoHistory() {
        const sequence = CONFIG.ROULETTE.SEQUENCE;
        for (let i = 0; i < 15; i++) {
            const num = sequence[Math.floor(Math.random() * sequence.length)];
            const color = CONFIG.ROULETTE.NUMBERS[num];
            this.addPreviousRoll({ number: num, color });
        }
    }

    async _startDemoRound() {
        // Clear previous round
        playersManager.clearAll();
        bettingManager.unlock();

        const bettingTime = CONFIG.BETTING.BETTING_TIME;

        // Start betting countdown
        rouletteEngine.startBetting(bettingTime);

        // Simulate other players betting during the phase
        this._generateDemoPlayers(bettingTime);

        // Wait for betting to end
        await this._sleep(bettingTime * 1000);

        // Lock bets
        bettingManager.lock();

        // Small pause before spinning
        await this._sleep(500);

        // Generate random winning number
        const sequence = CONFIG.ROULETTE.SEQUENCE;
        const winningNumber = sequence[Math.floor(Math.random() * sequence.length)];

        // Spin!
        casinoWheel.spin(winningNumber);
        const result = await rouletteEngine.spin(winningNumber);

        // Process results
        bettingManager.processResult(result.color);
        this.addPreviousRoll(result);

        // Wait before next round
        await this._sleep(CONFIG.ROULETTE.RESULT_DISPLAY_TIME);

        // Next round
        this._startDemoRound();
    }

    _generateDemoPlayers(bettingTimeSec) {
        const names = CONFIG.DEMO_PLAYERS;
        const numPlayers = 6 + Math.floor(Math.random() * 18);
        const usedNames = new Set();

        for (let i = 0; i < numPlayers; i++) {
            const delay = 300 + Math.random() * (bettingTimeSec * 900);

            setTimeout(() => {
                if (rouletteEngine.state !== 'betting') return;

                // Pick color (white is rarer)
                let color;
                const rand = Math.random();
                if (rand < 0.1) {
                    color = 'white';
                } else if (rand < 0.55) {
                    color = 'red';
                } else {
                    color = 'black';
                }

                // Pick unique name
                let name;
                do {
                    name = names[Math.floor(Math.random() * names.length)];
                } while (usedNames.has(name) && usedNames.size < names.length);
                usedNames.add(name);

                const level = Math.floor(Math.random() * 99) + 1;
                const amount = parseFloat((Math.random() * 500 + 0.50).toFixed(2));

                playersManager.addPlayer(color, {
                    id: `demo_${i}_${Date.now()}`,
                    username: name,
                    avatar: null,
                    level,
                    amount
                });
            }, delay);
        }
    }

    /* ═══════════════════════════════════════════
       UI Updates
       ═══════════════════════════════════════════ */

    setProfile(profile) {
        this.userProfile = profile;

        const nameEl = document.getElementById('profileName');
        const avatarEl = document.getElementById('profileAvatar');

        if (nameEl) nameEl.textContent = profile.username;

        if (avatarEl) {
            avatarEl.src = profile.avatar || playersManager._getDefaultAvatar(profile.username);
        }
    }

    updateBalance(amount) {
        this.userBalance = Math.round(amount * 100) / 100;

        const el = document.getElementById('balanceAmount');
        if (el) {
            el.textContent = this.userBalance.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            el.classList.add('balance--updated');
            setTimeout(() => el.classList.remove('balance--updated'), 600);
        }
    }

    /**
     * Add a roll result to the previous rolls display
     */
    addPreviousRoll(result) {
        this.previousRolls.unshift(result);
        if (this.previousRolls.length > CONFIG.MAX_PREVIOUS_ROLLS) {
            this.previousRolls.pop();
        }

        // Update stats
        this.rollsStats[result.color]++;

        this._renderPreviousRolls();
        this._renderStats();
    }

    _renderPreviousRolls() {
        const container = document.getElementById('rollsList');
        if (!container) return;

        container.innerHTML = '';

        this.previousRolls.forEach((roll, index) => {
            const el = document.createElement('div');
            el.className = `roll roll--${roll.color}`;
            el.textContent = roll.number;
            el.title = `#${roll.number} — ${CONFIG.COLOR_NAMES[roll.color]}`;

            if (index === 0) {
                el.style.animationDelay = '0s';
            }

            container.appendChild(el);
        });
    }

    _renderStats() {
        const statsRed = document.getElementById('statsRed');
        const statsWhite = document.getElementById('statsWhite');
        const statsBlack = document.getElementById('statsBlack');

        if (statsRed) statsRed.textContent = this.rollsStats.red;
        if (statsWhite) statsWhite.textContent = this.rollsStats.white;
        if (statsBlack) statsBlack.textContent = this.rollsStats.black;
    }

    /**
     * Simulate viewer count fluctuations in demo mode
     */
    _simulateViewerCount() {
        const el = document.getElementById('viewerCount');
        if (!el) return;

        let viewers = 800 + Math.floor(Math.random() * 600);
        el.textContent = viewers.toLocaleString('pt-BR');

        setInterval(() => {
            const delta = Math.floor((Math.random() - 0.45) * 30);
            viewers = Math.max(300, viewers + delta);
            el.textContent = viewers.toLocaleString('pt-BR');
        }, 3000);
    }

    /* ── Helpers ── */

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/* ═══════════════════════════════════════════
   Toast Notification System
   ═══════════════════════════════════════════ */

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 4000);
}

/* ═══════════════════════════════════════════
   Initialize Application
   ═══════════════════════════════════════════ */

const app = new App();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
