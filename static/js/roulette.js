/* ============================================
   Roulette Engine - Roleta Casino
   Handles spinning animation, timer, state,
   and ROLLING countdown overlay
   ============================================ */

class RouletteEngine {
    constructor() {
        this.viewport = null;
        this.strip = null;
        this.timerBar = null;
        this.statusText = null;
        this.rouletteEl = null;
        this.rollingOverlay = null;
        this.rollingCountdown = null;

        this.state = 'idle'; // idle | betting | spinning | result
        this.bettingTimeLeft = 0;
        this.bettingInterval = null;
        this.countdownInterval = null;
        this.items = [];

        this.soundEnabled = true;
    }

    /**
     * Initialize DOM references and generate initial strip
     */
    init() {
        this.viewport = document.getElementById('rouletteViewport');
        this.strip = document.getElementById('rouletteStrip');
        this.timerBar = document.getElementById('timerBar');
        this.statusText = document.getElementById('statusText');
        this.rouletteEl = document.getElementById('roulette');
        this.rollingOverlay = document.getElementById('rollingOverlay');
        this.rollingCountdown = document.getElementById('rollingCountdown');

        this.generateStrip();
    }

    /**
     * Generate the visual strip of colored circle items
     */
    generateStrip() {
        this.strip.innerHTML = '';
        this.items = [];

        const { SEQUENCE, STRIP_REPETITIONS, NUMBERS } = CONFIG.ROULETTE;

        for (let rep = 0; rep < STRIP_REPETITIONS; rep++) {
            SEQUENCE.forEach(num => {
                const color = NUMBERS[num];
                const item = document.createElement('div');
                item.className = `roulette__item roulette__item--${color}`;
                item.dataset.number = num;
                item.dataset.color = color;

                const numberSpan = document.createElement('span');
                numberSpan.className = 'roulette__number';
                numberSpan.textContent = num;
                item.appendChild(numberSpan);

                this.strip.appendChild(item);
                this.items.push({ element: item, number: num, color });
            });
        }

        // Reset position
        this.strip.style.transition = 'none';
        this.strip.style.transform = 'translateX(0px)';
    }

    /**
     * Start the betting phase with countdown
     */
    startBetting(timeSeconds) {
        this.setState('betting');
        this.bettingTimeLeft = timeSeconds;

        // UI updates
        this.statusText.textContent = `Apostas abertas — ${this.bettingTimeLeft}s`;
        this.timerBar.style.transition = 'none';
        this.timerBar.style.width = '100%';
        this.timerBar.classList.remove('timer__bar--urgent');
        this.rouletteEl.classList.remove('roulette--urgent', 'roulette--spinning', 'roulette--result');

        // Hide rolling overlay
        this._hideRollingOverlay();

        // Reset strip
        this.generateStrip();

        // Start countdown
        clearInterval(this.bettingInterval);
        this.bettingInterval = setInterval(() => {
            this.bettingTimeLeft--;

            const percent = (this.bettingTimeLeft / timeSeconds) * 100;
            this.timerBar.style.transition = 'width 1s linear';
            this.timerBar.style.width = `${percent}%`;

            if (this.bettingTimeLeft <= 5) {
                this.timerBar.classList.add('timer__bar--urgent');
                this.rouletteEl.classList.add('roulette--urgent');
                this.statusText.textContent = `Apostas fechando — ${this.bettingTimeLeft}s`;
            } else {
                this.statusText.textContent = `Apostas abertas — ${this.bettingTimeLeft}s`;
            }

            if (this.bettingTimeLeft <= 0) {
                clearInterval(this.bettingInterval);
                this.timerBar.classList.remove('timer__bar--urgent');
                this.rouletteEl.classList.remove('roulette--urgent');
                this.timerBar.style.width = '0%';
                this.statusText.textContent = 'Girando...';
            }
        }, 1000);
    }

    /**
     * Spin the roulette to a winning number
     * Shows ROLLING overlay with countdown during spin
     * @param {number} winningNumber - The number to land on (0-14)
     * @returns {Promise} Resolves with { number, color }
     */
    spin(winningNumber) {
        return new Promise((resolve) => {
            this.setState('spinning');
            this.rouletteEl.classList.add('roulette--spinning');
            this.rouletteEl.classList.remove('roulette--urgent');
            this.statusText.textContent = 'Girando...';

            clearInterval(this.bettingInterval);

            const { ITEM_SIZE, ITEM_GAP, SEQUENCE, SPIN_DURATION, STRIP_REPETITIONS, NUMBERS } = CONFIG.ROULETTE;
            const itemWidth = ITEM_SIZE + ITEM_GAP;
            const viewportWidth = this.viewport.offsetWidth;
            const centerOffset = viewportWidth / 2 - ITEM_SIZE / 2;

            // Target position: second-to-last repetition
            const sequenceLength = SEQUENCE.length;
            const targetRepetition = STRIP_REPETITIONS - 2;
            const indexInSequence = SEQUENCE.indexOf(winningNumber);
            const targetIndex = (targetRepetition * sequenceLength) + indexInSequence;

            const targetPosition = targetIndex * itemWidth;
            const translateX = -(targetPosition - centerOffset);

            // Show ROLLING countdown overlay (like CSGOEmpire)
            this._startRollingCountdown(SPIN_DURATION);

            // Apply spin animation
            this.strip.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.12, 0.8, 0.08, 1)`;
            void this.strip.offsetWidth; // Force reflow
            this.strip.style.transform = `translateX(${translateX}px)`;

            // On animation complete
            setTimeout(() => {
                const color = NUMBERS[winningNumber];

                this.setState('result');
                this.rouletteEl.classList.remove('roulette--spinning');
                this.rouletteEl.classList.add('roulette--result');

                this._hideRollingOverlay();

                this.statusText.innerHTML = `Resultado: <span class="result--${color}">${winningNumber}</span>`;

                // Highlight winner
                this._highlightWinner(targetIndex);

                resolve({ number: winningNumber, color });
            }, SPIN_DURATION + 300);
        });
    }

    /**
     * Show the ROLLING overlay with a decrementing countdown
     */
    _startRollingCountdown(durationMs) {
        if (!this.rollingOverlay || !this.rollingCountdown) return;

        this.rollingOverlay.classList.add('active');

        const startTime = Date.now();
        const totalSeconds = durationMs / 1000;

        this.rollingCountdown.textContent = totalSeconds.toFixed(2);

        clearInterval(this.countdownInterval);
        this.countdownInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, totalSeconds - elapsed);
            this.rollingCountdown.textContent = remaining.toFixed(2);

            if (remaining <= 0) {
                clearInterval(this.countdownInterval);
            }
        }, 30);
    }

    _hideRollingOverlay() {
        if (this.rollingOverlay) {
            this.rollingOverlay.classList.remove('active');
        }
        clearInterval(this.countdownInterval);
    }

    _highlightWinner(targetIndex) {
        if (this.items[targetIndex]) {
            this.items[targetIndex].element.classList.add('roulette__item--winner');
        }
    }

    setState(state) {
        this.state = state;
        document.body.dataset.gameState = state;
    }

    destroy() {
        clearInterval(this.bettingInterval);
        clearInterval(this.countdownInterval);
    }
}

const rouletteEngine = new RouletteEngine();
