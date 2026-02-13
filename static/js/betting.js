/* ============================================
   Betting Manager - Roleta Casino
   Handles bet placement, validation, and UI
   ============================================ */

class BettingManager {
    constructor() {
        this.betAmount = 0;
        this.betInput = null;

        // Tracks the user's bet for the current round per color
        this.currentBets = {
            red: null,
            white: null,
            black: null
        };

        this.isLocked = false;
    }

    /**
     * Initialize betting UI and event listeners
     */
    init() {
        this.betInput = document.getElementById('betAmount');
        this._setupQuickActions();
        this._setupBetButtons();
        this._setupInputListeners();
    }

    /* ── Setup ── */

    _setupQuickActions() {
        document.querySelectorAll('.bet-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const value = parseFloat(btn.dataset.value) || 0;

                switch (action) {
                    case 'clear':
                        this.setBetAmount(0);
                        break;
                    case 'add':
                        this.setBetAmount(this.betAmount + value);
                        break;
                    case 'half':
                        this.setBetAmount(this.betAmount / 2);
                        break;
                    case 'double':
                        this.setBetAmount(this.betAmount * 2);
                        break;
                    case 'max':
                        this.setBetAmount(this._getMaxBet());
                        break;
                }
            });
        });
    }

    _setupBetButtons() {
        ['red', 'white', 'black'].forEach(color => {
            const btnId = `bet${color.charAt(0).toUpperCase() + color.slice(1)}`;
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.placeBet(color));
            }
        });
    }

    _setupInputListeners() {
        this.betInput.addEventListener('input', () => {
            this.betAmount = parseFloat(this.betInput.value) || 0;
        });

        // Allow Enter to focus bet buttons area
        this.betInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.betInput.blur();
            }
        });
    }

    /* ── Bet Amount Management ── */

    setBetAmount(amount) {
        // Round to 2 decimal places
        this.betAmount = Math.max(0, Math.round(amount * 100) / 100);
        this.betInput.value = this.betAmount > 0 ? this.betAmount.toFixed(2) : '';
    }

    _getMaxBet() {
        const balance = app ? app.userBalance : 0;
        // Use the lowest multiplier (2x) for safest max
        return Math.min(balance, CONFIG.BETTING.MAX_PAYOUT / 2);
    }

    _getMaxBetForColor(color) {
        const multiplier = CONFIG.BETTING.MULTIPLIERS[color];
        const maxFromPayout = CONFIG.BETTING.MAX_PAYOUT / multiplier;
        const balance = app ? app.userBalance : 0;
        return Math.min(balance, maxFromPayout);
    }

    /* ── Bet Placement ── */

    async placeBet(color) {
        // Validations
        if (this.isLocked) {
            showToast('Apostas estão fechadas!', 'error');
            return;
        }

        if (rouletteEngine.state !== 'betting') {
            showToast('Aguarde a próxima rodada para apostar!', 'error');
            return;
        }

        if (this.betAmount <= 0) {
            showToast('Insira um valor para apostar!', 'warning');
            return;
        }

        if (this.betAmount < CONFIG.BETTING.MIN_BET) {
            showToast(`Aposta mínima: R$ ${CONFIG.BETTING.MIN_BET.toFixed(2)}`, 'warning');
            return;
        }

        const maxBet = this._getMaxBetForColor(color);
        if (this.betAmount > maxBet) {
            const colorName = CONFIG.COLOR_NAMES[color];
            showToast(`Aposta máxima para ${colorName}: R$ ${maxBet.toFixed(2)}`, 'warning');
            return;
        }

        const balance = app ? app.userBalance : 0;
        if (this.betAmount > balance) {
            showToast('Saldo insuficiente!', 'error');
            return;
        }

        if (this.currentBets[color]) {
            showToast('Você já apostou nesta cor nesta rodada!', 'warning');
            return;
        }

        // Place the bet
        try {
            if (CONFIG.DEMO_MODE) {
                await this._placeDemoBet(color);
            } else {
                await this._placeRealBet(color);
            }
        } catch (error) {
            showToast(error.message || 'Erro ao realizar aposta', 'error');
        }
    }

    async _placeDemoBet(color) {
        this.currentBets[color] = {
            color,
            amount: this.betAmount,
            timestamp: Date.now()
        };

        // Update balance
        if (app) {
            app.updateBalance(app.userBalance - this.betAmount);
        }

        // Add to players list
        playersManager.addPlayer(color, {
            id: 'self',
            username: document.getElementById('profileName').textContent,
            avatar: document.getElementById('profileAvatar').src,
            level: app.userProfile ? app.userProfile.level : 1,
            amount: this.betAmount,
            isSelf: true
        });

        const colorName = CONFIG.COLOR_NAMES[color];
        showToast(`Aposta de R$ ${this.betAmount.toFixed(2)} no ${colorName}!`, 'success');
    }

    async _placeRealBet(color) {
        const response = await api.placeBet(color, this.betAmount);

        this.currentBets[color] = {
            id: response.bet_id,
            color,
            amount: this.betAmount,
            timestamp: Date.now()
        };

        if (app && response.balance !== undefined) {
            app.updateBalance(response.balance);
        }

        const colorName = CONFIG.COLOR_NAMES[color];
        showToast(`Aposta de R$ ${this.betAmount.toFixed(2)} no ${colorName}!`, 'success');
    }

    /* ── Lock / Unlock ── */

    lock() {
        this.isLocked = true;
        document.querySelectorAll('.panel__bet-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('panel__bet-btn--disabled');
        });
    }

    unlock() {
        this.isLocked = false;
        this.currentBets = { red: null, white: null, black: null };
        document.querySelectorAll('.panel__bet-btn').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('panel__bet-btn--disabled');
        });
    }

    /* ── Result Processing ── */

    processResult(winningColor) {
        let totalWin = 0;

        Object.entries(this.currentBets).forEach(([color, bet]) => {
            if (!bet) return;

            if (color === winningColor) {
                const multiplier = CONFIG.BETTING.MULTIPLIERS[color];
                const winAmount = bet.amount * multiplier;
                totalWin += winAmount;
            }
        });

        if (totalWin > 0) {
            showToast(`Você ganhou R$ ${totalWin.toFixed(2)}!`, 'success');
            if (app) {
                app.updateBalance(app.userBalance + totalWin);
            }
        } else {
            // Check if user placed any bets
            const hadBets = Object.values(this.currentBets).some(b => b !== null);
            if (hadBets) {
                showToast('Não foi dessa vez...', 'error');
            }
        }
    }
}

const bettingManager = new BettingManager();
