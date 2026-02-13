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

        // Setup UI interactions
        this._setupProfileDropdown();
        this._setupSoundToggle();
        this._setupLivestreamToggle();

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
