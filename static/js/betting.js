/* ============================================
   Betting Manager - Roleta Casino
   Handles bet placement, validation, and UI
   ============================================ */

class BettingManager {
    constructor() {
        this.betAmount = 0;
        this.betInput = null;

        // Tracks bets per type for current round
        this.currentBets = {
            red: null,
            white: null,
            black: null,
            odd: null,
            even: null,
            straight: {} // keyed by number: { amount, timestamp }
        };

        this.isLocked = false;

        // History of all rounds (for display)
        this.history = [];
        this.roundCounter = 0;
    }

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
                    case 'clear': this.setBetAmount(0); break;
                    case 'add': this.setBetAmount(this.betAmount + value); break;
                    case 'half': this.setBetAmount(this.betAmount / 2); break;
                    case 'double': this.setBetAmount(this.betAmount * 2); break;
                    case 'max': this.setBetAmount(this._getMaxBet()); break;
                }
            });
        });
    }

    _setupBetButtons() {
        ['red', 'white', 'black'].forEach(color => {
            const btnId = `bet${color.charAt(0).toUpperCase() + color.slice(1)}`;
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.placeBet('color', color));
            }
        });
    }

    _setupInputListeners() {
        if (!this.betInput) return;
        this.betInput.addEventListener('input', () => {
            this.betAmount = parseFloat(this.betInput.value) || 0;
        });
        this.betInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.betInput.blur(); }
        });
    }

    /* ── Bet Amount ── */

    setBetAmount(amount) {
        this.betAmount = Math.max(0, Math.round(amount * 100) / 100);
        if (this.betInput) {
            this.betInput.value = this.betAmount > 0 ? this.betAmount.toFixed(2) : '';
        }
    }

    _getMaxBet() {
        const balance = app ? app.userBalance : 0;
        return Math.min(balance, CONFIG.BETTING.MAX_PAYOUT / 2);
    }

    _getMultiplier(betType, betValue) {
        if (betType === 'straight') return CONFIG.BETTING.MULTIPLIERS.straight;
        if (betType === 'parity') return CONFIG.BETTING.MULTIPLIERS[betValue] || 2;
        return CONFIG.BETTING.MULTIPLIERS[betValue] || 2;
    }

    /* ── Bet Placement ── */

    /**
     * @param {string} betType - 'color', 'straight', or 'parity'
     * @param {string|number} betValue - color name, number, or 'odd'/'even'
     */
    async placeBet(betType, betValue) {
        // Common validations
        if (this.isLocked) {
            showToast('Apostas estão fechadas!', 'error');
            return;
        }
        if (rouletteEngine.state !== 'betting') {
            showToast('Aguarde a próxima rodada!', 'error');
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

        const balance = app ? app.userBalance : 0;
        if (this.betAmount > balance) {
            showToast('Saldo insuficiente!', 'error');
            return;
        }

        // Check duplicates
        if (betType === 'color' && this.currentBets[betValue]) {
            showToast('Você já apostou nesta cor!', 'warning');
            return;
        }
        if (betType === 'parity' && this.currentBets[betValue]) {
            showToast('Você já apostou em ' + (betValue === 'odd' ? 'Ímpar' : 'Par') + '!', 'warning');
            return;
        }
        if (betType === 'straight' && this.currentBets.straight[betValue] !== undefined) {
            showToast(`Você já apostou no número ${betValue}!`, 'warning');
            return;
        }

        // Max payout check
        const multiplier = this._getMultiplier(betType, betValue);
        const maxFromPayout = CONFIG.BETTING.MAX_PAYOUT / multiplier;
        if (this.betAmount > maxFromPayout) {
            showToast(`Aposta máxima: R$ ${maxFromPayout.toFixed(2)}`, 'warning');
            return;
        }

        // Place bet
        try {
            if (CONFIG.DEMO_MODE) {
                this._placeDemoBet(betType, betValue);
            } else {
                await this._placeRealBet(betType, betValue);
            }
            soundEngine.chipPlace();
        } catch (error) {
            showToast(error.message || 'Erro ao realizar aposta', 'error');
        }
    }

    _placeDemoBet(betType, betValue) {
        const bet = { amount: this.betAmount, timestamp: Date.now() };

        // Store bet
        if (betType === 'straight') {
            this.currentBets.straight[betValue] = bet;
        } else if (betType === 'parity') {
            this.currentBets[betValue] = bet;
        } else {
            this.currentBets[betValue] = bet;
        }

        // Deduct balance
        if (app) app.updateBalance(app.userBalance - this.betAmount);

        // Add to players list (map to color for display)
        let displayColor = betValue;
        if (betType === 'straight') {
            displayColor = CONFIG.ROULETTE.NUMBERS[betValue];
        } else if (betType === 'parity') {
            displayColor = betValue === 'odd' ? 'red' : 'black';
        }

        playersManager.addPlayer(displayColor, {
            id: 'self',
            username: document.getElementById('profileName')?.textContent || 'Jogador',
            avatar: document.getElementById('profileAvatar')?.src,
            level: app?.userProfile?.level || 1,
            amount: this.betAmount,
            isSelf: true
        });

        // Toast
        let label;
        if (betType === 'straight') label = `número ${betValue}`;
        else if (betType === 'parity') label = betValue === 'odd' ? 'Ímpar' : 'Par';
        else label = CONFIG.COLOR_NAMES[betValue];

        showToast(`Aposta de R$ ${this.betAmount.toFixed(2)} no ${label}!`, 'success');
    }

    async _placeRealBet(betType, betValue) {
        const response = await api.placeBet(betValue, this.betAmount);
        const bet = { id: response.bet_id, amount: this.betAmount, timestamp: Date.now() };

        if (betType === 'straight') {
            this.currentBets.straight[betValue] = bet;
        } else if (betType === 'parity') {
            this.currentBets[betValue] = bet;
        } else {
            this.currentBets[betValue] = bet;
        }

        if (app && response.balance !== undefined) app.updateBalance(response.balance);
        showToast(`Aposta realizada!`, 'success');
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
        this.currentBets = { red: null, white: null, black: null, odd: null, even: null, straight: {} };
        this.roundCounter++;
        document.querySelectorAll('.panel__bet-btn').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('panel__bet-btn--disabled');
        });
    }

    /* ── Result Processing ── */

    /**
     * Process result and return win/loss info
     * @returns {{ totalWin: number, totalBet: number, hadBets: boolean, bets: array }}
     */
    processResult(winningNumber, winningColor) {
        let totalWin = 0;
        let totalBet = 0;
        const betDetails = [];

        // 1. Color bets
        ['red', 'white', 'black'].forEach(color => {
            const bet = this.currentBets[color];
            if (!bet) return;
            totalBet += bet.amount;
            const won = color === winningColor;
            const payout = won ? bet.amount * CONFIG.BETTING.MULTIPLIERS[color] : 0;
            if (won) totalWin += payout;
            betDetails.push({ type: CONFIG.COLOR_NAMES[color], amount: bet.amount, won, payout });
        });

        // 2. Parity bets (0 = neither, loses)
        ['odd', 'even'].forEach(parity => {
            const bet = this.currentBets[parity];
            if (!bet) return;
            totalBet += bet.amount;
            let won = false;
            if (winningNumber > 0) {
                const isOdd = winningNumber % 2 === 1;
                won = (parity === 'odd' && isOdd) || (parity === 'even' && !isOdd);
            }
            const payout = won ? bet.amount * CONFIG.BETTING.MULTIPLIERS[parity] : 0;
            if (won) totalWin += payout;
            betDetails.push({ type: parity === 'odd' ? 'Ímpar' : 'Par', amount: bet.amount, won, payout });
        });

        // 3. Straight bets (exact number)
        Object.entries(this.currentBets.straight).forEach(([num, bet]) => {
            totalBet += bet.amount;
            const won = parseInt(num) === winningNumber;
            const payout = won ? bet.amount * CONFIG.BETTING.MULTIPLIERS.straight : 0;
            if (won) totalWin += payout;
            betDetails.push({ type: `Nº ${num}`, amount: bet.amount, won, payout });
        });

        const hadBets = totalBet > 0;

        // Update balance with winnings
        if (totalWin > 0 && app) {
            app.updateBalance(app.userBalance + totalWin);
        }

        // Save to history
        if (hadBets) {
            this.history.unshift({
                round: this.roundCounter,
                number: winningNumber,
                color: winningColor,
                bets: betDetails,
                totalBet,
                totalWin,
                profit: totalWin - totalBet,
                time: new Date()
            });
            if (this.history.length > 50) this.history.pop();
        }

        return { totalWin, totalBet, hadBets, bets: betDetails };
    }
}

const bettingManager = new BettingManager();
