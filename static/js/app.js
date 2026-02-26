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

    async init() {
        console.log('Roleta Casino — Initializing...');

        // Initialize components
        rouletteEngine.init();
        bettingManager.init();
        playersManager.init();
        casinoWheel.init();
        chipManager.init();
        chatManager.init();

        // Setup UI
        this._setupProfileDropdown();
        this._setupSoundToggle();
        this._setupLivestreamToggle();
        this._setupTableBetting();
        this._setupHistoryPanel();

        // Connect or demo
        if (CONFIG.DEMO_MODE) {
            this._initDemoMode();
        } else {
            wsManager.connect();
            this._setupWebSocketListeners();
            await this._loadInitialData();
        }

        console.log('Roleta Casino — Ready!');
    }

    /* ═══════════════════════════════════════════
       UI Setup
       ═══════════════════════════════════════════ */

    _setupTableBetting() {
        const table = document.getElementById('rouletteTable');
        if (!table) return;

        table.addEventListener('click', async (e) => {
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
                showToast('Selecione uma ficha para apostar!', 'warning');
                return;
            }

            if (amount > this.userBalance) {
                showToast('Saldo insuficiente!', 'error');
                return;
            }

            // Route to correct bet type
            let betPlaced = false;
            if (betType === 'straight') {
                const num = parseInt(cell.dataset.number);
                betPlaced = await bettingManager.placeBet('straight', num);
            } else if (betType === 'color') {
                const color = cell.dataset.color;
                betPlaced = await bettingManager.placeBet('color', color);
            } else if (betType === 'parity') {
                const parity = cell.dataset.parity;
                betPlaced = await bettingManager.placeBet('parity', parity);
            }

            if (betPlaced) {
                this._placeChipOnCell(cell, amount);
            }
        });
    }

    _getChipColor(value) {
        if (value >= 1000) return 'purple';
        if (value >= 500) return 'gold';
        if (value >= 100) return 'black';
        if (value >= 25) return 'green';
        if (value >= 5) return 'red';
        if (value >= 1) return 'blue';
        return 'white';
    }

    _placeChipOnCell(cell, amount) {
        const currentTotal = parseFloat(cell.dataset.betTotal || '0');
        const newTotal = currentTotal + amount;
        cell.dataset.betTotal = newTotal;

        // Update or create chip visual
        let chip = cell.querySelector('.table__chip');
        if (!chip) {
            chip = document.createElement('div');
            chip.className = 'table__chip table__chip--self';
            cell.appendChild(chip);
        }

        // Update chip color to match the selected chip
        const colorClass = 'table__chip--' + this._getChipColor(amount);
        chip.className = 'table__chip table__chip--self ' + colorClass;

        // Format label
        let label;
        if (newTotal >= 1000) label = (newTotal / 1000).toFixed(1) + 'k';
        else if (newTotal >= 1) label = newTotal.toFixed(0);
        else label = newTotal.toFixed(2);
        chip.textContent = label;

        // Re-trigger bounce animation
        chip.style.animation = 'none';
        void chip.offsetWidth;
        chip.style.animation = '';

        // Stacking visual: deeper shadow for higher totals
        if (newTotal > amount) {
            chip.classList.add('table__chip--stacked');
        }

        cell.classList.add('table__cell--has-bet');
    }

    clearTableChips() {
        const table = document.getElementById('rouletteTable');
        if (!table) return;
        table.querySelectorAll('.table__chip').forEach(c => c.remove());
        table.querySelectorAll('.table__cell--has-bet').forEach(c => c.classList.remove('table__cell--has-bet'));
        table.querySelectorAll('[data-bet-total]').forEach(c => delete c.dataset.betTotal);
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
            soundEngine.enabled = this.soundEnabled;
        });
    }

    _setupLivestreamToggle() {
        const toggle = document.getElementById('livestreamToggle');
        const livestream = document.getElementById('livestream');
        if (!toggle || !livestream) return;

        // Collapse on mobile by default
        if (window.innerWidth <= 768) {
            livestream.classList.add('livestream--collapsed');
        }

        toggle.addEventListener('click', () => {
            livestream.classList.toggle('livestream--collapsed');
        });

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

        if (CONFIG.DEMO_MODE) this._simulateViewerCount();
    }

    _setupHistoryPanel() {
        const header = document.getElementById('historyToggle');
        const panel = document.getElementById('historyPanel');
        if (!header || !panel) return;

        header.addEventListener('click', () => {
            panel.classList.toggle('history-panel--open');
            this._renderHistory();
        });
    }

    /* ═══════════════════════════════════════════
       WebSocket Integration
       ═══════════════════════════════════════════ */

    _setupWebSocketListeners() {
        wsManager.on('round_start', (data) => {
            playersManager.clearAll();
            this.clearTableChips();
            bettingManager.unlock();
            rouletteEngine.startBetting(data.betting_time || CONFIG.BETTING.BETTING_TIME);
        });

        wsManager.on('bet_placed', (data) => {
            if (data.player && data.color) {
                playersManager.addPlayer(data.color, data.player);
            }
        });

        wsManager.on('betting_closed', () => {
            bettingManager.lock();
        });

        wsManager.on('spin', async (data) => {
            bettingManager.lock();
            casinoWheel.spin(data.winning_number);
            const result = await rouletteEngine.spin(data.winning_number);
            this._onSpinComplete(result);
        });

        wsManager.on('balance_update', (data) => {
            if (data.balance !== undefined) this.updateBalance(data.balance);
        });

        wsManager.on('error', (data) => {
            showToast(data.message || 'Erro do servidor', 'error');
        });

        wsManager.on('connected', () => showToast('Conectado ao servidor', 'success'));
        wsManager.on('disconnected', () => showToast('Conexão perdida. Reconectando...', 'warning'));
        wsManager.on('reconnect_failed', () => showToast('Não foi possível reconectar.', 'error'));
    }

    async _loadInitialData() {
        try {
            const [profile, balanceData, history] = await Promise.all([
                api.getProfile(), api.getBalance(), api.getHistory(),
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
            console.error('Failed to load:', error);
            showToast('Erro ao carregar dados', 'error');
        }
    }

    /* ═══════════════════════════════════════════
       Demo Mode
       ═══════════════════════════════════════════ */

    _initDemoMode() {
        console.log('Demo mode active');
        this.setProfile({ username: 'Jogador_Demo', avatar: null, level: 42 });
        this.updateBalance(5000.00);
        this._generateDemoHistory();
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
        playersManager.clearAll();
        this.clearTableChips();
        bettingManager.unlock();

        const bettingTime = CONFIG.BETTING.BETTING_TIME;
        rouletteEngine.startBetting(bettingTime);
        this._generateDemoPlayers(bettingTime);

        // Countdown sound in last 5 seconds
        for (let i = 5; i > 0; i--) {
            setTimeout(() => {
                if (rouletteEngine.state === 'betting' && this.soundEnabled) {
                    soundEngine.countdown();
                }
            }, (bettingTime - i) * 1000);
        }

        await this._sleep(bettingTime * 1000);
        bettingManager.lock();
        await this._sleep(500);

        const sequence = CONFIG.ROULETTE.SEQUENCE;
        const winningNumber = sequence[Math.floor(Math.random() * sequence.length)];

        // Spin both
        casinoWheel.spin(winningNumber);
        const result = await rouletteEngine.spin(winningNumber);

        // Process result
        this._onSpinComplete(result);

        await this._sleep(CONFIG.ROULETTE.RESULT_DISPLAY_TIME);
        this._startDemoRound();
    }

    /**
     * Called after spin animation completes
     */
    _onSpinComplete(result) {
        const betResult = bettingManager.processResult(result.number, result.color);

        // Show result display overlay
        this._showResultDisplay(result, betResult);

        // Add to history
        this.addPreviousRoll(result);

        // Chat reaction
        chatManager.onResult(result.number, result.color);

        // Sound feedback
        if (this.soundEnabled) {
            if (betResult.totalWin > betResult.totalBet * 5) {
                soundEngine.bigWin();
            } else if (betResult.totalWin > 0) {
                soundEngine.win();
            } else if (betResult.hadBets) {
                soundEngine.loss();
            }
        }

        // If big win, announce in chat
        if (betResult.totalWin > 100) {
            const username = this.userProfile?.username || 'Jogador';
            chatManager.onBigWin(username, betResult.totalWin);
        }

        // Render history panel
        this._renderHistory();
    }

    _generateDemoPlayers(bettingTimeSec) {
        const names = CONFIG.DEMO_PLAYERS;
        const numPlayers = 6 + Math.floor(Math.random() * 18);
        const usedNames = new Set();

        for (let i = 0; i < numPlayers; i++) {
            const delay = 300 + Math.random() * (bettingTimeSec * 900);
            setTimeout(() => {
                if (rouletteEngine.state !== 'betting') return;

                let color;
                const rand = Math.random();
                if (rand < 0.1) color = 'white';
                else if (rand < 0.55) color = 'red';
                else color = 'black';

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
       Result Display + Win Animation
       ═══════════════════════════════════════════ */

    _showResultDisplay(result, betResult) {
        const overlay = document.getElementById('resultDisplay');
        const numEl = document.getElementById('resultNumber');
        const colorEl = document.getElementById('resultColor');
        const outcomeEl = document.getElementById('resultOutcome');
        if (!overlay || !numEl) return;

        // Set number and color
        numEl.textContent = result.number;
        numEl.className = `result-display__number result-display__number--${result.color}`;
        colorEl.textContent = CONFIG.COLOR_NAMES[result.color];

        // Set outcome
        if (betResult.hadBets) {
            if (betResult.totalWin > 0) {
                const profit = betResult.totalWin - betResult.totalBet;
                outcomeEl.textContent = `+R$ ${betResult.totalWin.toFixed(2)}`;
                outcomeEl.className = 'result-display__outcome result-display__outcome--win';
                overlay.classList.add('result-display--win');

                // Confetti!
                this._spawnConfetti();

                // Floating win amount
                this._showFloatingWin(betResult.totalWin);
            } else {
                outcomeEl.textContent = `-R$ ${betResult.totalBet.toFixed(2)}`;
                outcomeEl.className = 'result-display__outcome result-display__outcome--loss';
                overlay.classList.remove('result-display--win');
            }
        } else {
            outcomeEl.textContent = '';
            outcomeEl.className = 'result-display__outcome result-display__outcome--none';
            overlay.classList.remove('result-display--win');
        }

        // Show
        overlay.classList.add('result-display--visible');

        // Auto-hide
        setTimeout(() => {
            overlay.classList.remove('result-display--visible', 'result-display--win');
        }, 3500);
    }

    _spawnConfetti() {
        const colors = ['#e84040', '#f2b10c', '#00c74d', '#4488ee', '#9955dd', '#ff6b6b', '#ffd700'];
        const count = 40;

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const size = 4 + Math.random() * 8;
            const duration = 1.5 + Math.random() * 2;
            const delay = Math.random() * 0.8;
            const shape = Math.random() > 0.5 ? '50%' : '0';

            Object.assign(particle.style, {
                left: left + 'vw',
                top: '-10px',
                width: size + 'px',
                height: size + 'px',
                background: color,
                borderRadius: shape,
                animationDuration: duration + 's',
                animationDelay: delay + 's',
            });

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), (duration + delay) * 1000 + 200);
        }
    }

    _showFloatingWin(amount) {
        const el = document.createElement('div');
        el.className = 'floating-win';
        el.textContent = `+R$ ${amount.toFixed(2)}`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2200);
    }

    /* ═══════════════════════════════════════════
       History Panel
       ═══════════════════════════════════════════ */

    _renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;

        const history = bettingManager.history;

        if (history.length === 0) {
            list.innerHTML = `
                <div class="history-panel__empty">
                    <i class="fas fa-dice"></i>
                    Nenhuma aposta realizada ainda
                </div>
            `;
            return;
        }

        list.innerHTML = history.map(entry => {
            const profitClass = entry.profit >= 0 ? 'history__profit--win' : 'history__profit--loss';
            const profitSign = entry.profit >= 0 ? '+' : '';
            const betLabels = entry.bets.map(b => b.type).join(', ');

            return `
                <div class="history__entry">
                    <span class="history__round">#${entry.round}</span>
                    <span class="history__result-num history__result-num--${entry.color}">${entry.number}</span>
                    <span class="history__bet-type">${betLabels}</span>
                    <span class="history__amount">R$ ${entry.totalBet.toFixed(2)}</span>
                    <span class="history__profit ${profitClass}">${profitSign}R$ ${entry.profit.toFixed(2)}</span>
                </div>
            `;
        }).join('');
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

    addPreviousRoll(result) {
        this.previousRolls.unshift(result);
        if (this.previousRolls.length > CONFIG.MAX_PREVIOUS_ROLLS) {
            this.previousRolls.pop();
        }
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
            if (index === 0) el.style.animationDelay = '0s';
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
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 4000);
}

/* ═══════════════════════════════════════════
   Initialize
   ═══════════════════════════════════════════ */

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
