/* ============================================
   Casino Wheel + Chip Drag System
   Visual spinning wheel and drag-to-bet chips
   ============================================ */

class CasinoWheel {
    constructor() {
        this.container = null;
        this.spinner = null;
        this.currentRotation = 0;
        this.sequence = CONFIG.ROULETTE.SEQUENCE;
        this.segmentAngle = 360 / this.sequence.length;
    }

    init() {
        this.container = document.getElementById('casinoWheel');
        if (!this.container) return;
        this.render();
        this.spinner = document.getElementById('wheelSpinner');
    }

    render() {
        const size = 300;
        const cx = size / 2;
        const cy = size / 2;
        const outerR = size / 2 - 6;
        const innerR = outerR * 0.32;
        const textR = outerR * 0.7;
        const seq = this.sequence;
        const nums = CONFIG.ROULETTE.NUMBERS;

        let paths = '';
        seq.forEach((num, i) => {
            const color = nums[num];
            const a1 = (i * this.segmentAngle - 90) * Math.PI / 180;
            const a2 = ((i + 1) * this.segmentAngle - 90) * Math.PI / 180;
            const amid = (a1 + a2) / 2;

            // Outer arc points
            const ox1 = cx + outerR * Math.cos(a1);
            const oy1 = cy + outerR * Math.sin(a1);
            const ox2 = cx + outerR * Math.cos(a2);
            const oy2 = cy + outerR * Math.sin(a2);
            // Inner arc points
            const ix1 = cx + innerR * Math.cos(a1);
            const iy1 = cy + innerR * Math.sin(a1);
            const ix2 = cx + innerR * Math.cos(a2);
            const iy2 = cy + innerR * Math.sin(a2);

            const fill = this._color(color);
            const d = `M${ix1},${iy1} L${ox1},${oy1} A${outerR},${outerR} 0 0,1 ${ox2},${oy2} L${ix2},${iy2} A${innerR},${innerR} 0 0,0 ${ix1},${iy1}Z`;

            // Text position
            const tx = cx + textR * Math.cos(amid);
            const ty = cy + textR * Math.sin(amid);
            const trot = (i * this.segmentAngle - 90 + this.segmentAngle / 2) + 90;

            const textFill = color === 'white' ? '#1a1a2e' : '#fff';

            paths += `<path d="${d}" fill="${fill}" stroke="#111520" stroke-width="0.8"/>`;
            paths += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" fill="${textFill}" font-size="14" font-weight="800" transform="rotate(${trot},${tx},${ty})">${num}</text>`;
        });

        // Separator lines
        let lines = '';
        seq.forEach((_, i) => {
            const a = (i * this.segmentAngle - 90) * Math.PI / 180;
            lines += `<line x1="${cx + innerR * Math.cos(a)}" y1="${cy + innerR * Math.sin(a)}" x2="${cx + outerR * Math.cos(a)}" y2="${cy + outerR * Math.sin(a)}" stroke="#c9a82f" stroke-width="0.5" opacity="0.4"/>`;
        });

        this.container.innerHTML = `
            <div class="wheel__outer">
                <div class="wheel__pointer"></div>
                <div class="wheel__frame">
                    <div class="wheel__spinner" id="wheelSpinner">
                        <svg viewBox="0 0 ${size} ${size}" class="wheel__svg">
                            <defs>
                                <filter id="wheelShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/></filter>
                            </defs>
                            <!-- Outer gold ring -->
                            <circle cx="${cx}" cy="${cy}" r="${outerR + 3}" fill="none" stroke="url(#goldRing)" stroke-width="5"/>
                            <linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#e6c44d"/>
                                <stop offset="50%" stop-color="#c9a82f"/>
                                <stop offset="100%" stop-color="#e6c44d"/>
                            </linearGradient>
                            <!-- Segments -->
                            <g filter="url(#wheelShadow)">${paths}</g>
                            <!-- Separator lines -->
                            ${lines}
                            <!-- Inner hub -->
                            <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#0d1117" stroke="#c9a82f" stroke-width="2"/>
                            <!-- Hub decoration -->
                            <circle cx="${cx}" cy="${cy}" r="${innerR - 8}" fill="none" stroke="rgba(201,168,47,0.3)" stroke-width="1"/>
                            <circle cx="${cx}" cy="${cy}" r="10" fill="#c9a82f"/>
                            <circle cx="${cx}" cy="${cy}" r="5" fill="#0d1117"/>
                        </svg>
                    </div>
                </div>
                <div class="wheel__ball-track">
                    <div class="wheel__ball" id="wheelBall"></div>
                </div>
            </div>
        `;

        this.spinner = document.getElementById('wheelSpinner');
    }

    spin(winningNumber) {
        if (!this.spinner) return;

        const index = this.sequence.indexOf(winningNumber);
        const targetMid = index * this.segmentAngle + this.segmentAngle / 2;
        const targetAngle = 360 - targetMid;

        // Calculate delta from current position to target position
        const currentAngle = this.currentRotation % 360;
        const delta = ((targetAngle - currentAngle) % 360 + 360) % 360;

        // 5 full turns + precise delta to land on correct segment
        const fullTurns = 5 * 360;
        const total = this.currentRotation + fullTurns + delta;

        this.spinner.style.transition = `transform ${CONFIG.ROULETTE.SPIN_DURATION}ms cubic-bezier(0.12, 0.8, 0.08, 1)`;
        void this.spinner.offsetWidth;
        this.spinner.style.transform = `rotate(${total}deg)`;
        this.currentRotation = total;

        // Animate ball in opposite direction
        const ball = document.getElementById('wheelBall');
        if (ball) {
            ball.classList.add('wheel__ball--spinning');
            setTimeout(() => ball.classList.remove('wheel__ball--spinning'), CONFIG.ROULETTE.SPIN_DURATION);
        }
    }

    _color(c) {
        return { red: '#c0312f', black: '#262936', white: '#d4a017' }[c] || '#333';
    }
}

/* ════════════════════════════════════════════
   CHIP MANAGER — Select & Drag chips to table
   ════════════════════════════════════════════ */

class ChipManager {
    constructor() {
        this.selectedValue = null;
        this.dragClone = null;
    }

    init() {
        this._setupRack();
        this._setupTableHover();
    }

    _setupRack() {
        const rack = document.getElementById('chipRack');
        if (!rack) return;

        rack.querySelectorAll('.chip-rack__chip').forEach(chip => {
            // Click to select
            chip.addEventListener('click', () => {
                this._select(parseFloat(chip.dataset.value), chip);
            });

            // Drag start (mouse)
            chip.addEventListener('mousedown', (e) => this._dragStart(e, chip));
            // Drag start (touch)
            chip.addEventListener('touchstart', (e) => this._dragStart(e, chip), { passive: false });
        });

        // Clear button
        const clearBtn = document.getElementById('chipClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                app.clearTableChips();
                this._deselectAll();
            });
        }
    }

    _select(value, el) {
        const wasSelected = el.classList.contains('chip-rack__chip--selected');
        this._deselectAll();

        if (!wasSelected) {
            this.selectedValue = value;
            el.classList.add('chip-rack__chip--selected');
            bettingManager.setBetAmount(value);
            document.body.classList.add('chip-selected');
        } else {
            this.selectedValue = null;
            document.body.classList.remove('chip-selected');
        }
    }

    _deselectAll() {
        this.selectedValue = null;
        document.querySelectorAll('.chip-rack__chip--selected').forEach(c => c.classList.remove('chip-rack__chip--selected'));
        document.body.classList.remove('chip-selected');
    }

    /* ── Drag & Drop ── */

    _dragStart(e, chipEl) {
        if (e.button && e.button !== 0) return; // Only left click
        e.preventDefault();

        const value = parseFloat(chipEl.dataset.value);
        this._select(value, chipEl);

        // Create floating chip clone (larger, with color)
        const rect = chipEl.getBoundingClientRect();
        this.dragClone = chipEl.cloneNode(true);
        this.dragClone.className = 'chip-rack__chip chip-rack__chip--ghost ' +
            Array.from(chipEl.classList).filter(c => c.startsWith('chip--')).join(' ');
        const ghostSize = Math.max(rect.width, 56);
        Object.assign(this.dragClone.style, {
            position: 'fixed',
            zIndex: '9999',
            pointerEvents: 'none',
            width: ghostSize + 'px',
            height: ghostSize + 'px',
            transition: 'none',
            opacity: '0.92',
        });
        document.body.appendChild(this.dragClone);
        this._positionClone(e);

        // Add drag state
        document.body.classList.add('chip-dragging');
        this._highlightDropTargets(true);

        const move = (ev) => { ev.preventDefault(); this._positionClone(ev); };
        const end = (ev) => {
            this._dragEnd(ev);
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', end);
            document.removeEventListener('touchmove', move);
            document.removeEventListener('touchend', end);
        };

        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', end);
    }

    _positionClone(e) {
        if (!this.dragClone) return;
        const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        const halfSize = this.dragClone.offsetWidth / 2 || 28;
        this.dragClone.style.left = (x - halfSize) + 'px';
        this.dragClone.style.top = (y - halfSize) + 'px';

        // Detect cell under cursor for drag-over highlight
        // Temporarily hide clone to use elementFromPoint
        this.dragClone.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        this.dragClone.style.display = '';

        // Remove previous drag-over
        const prev = document.querySelector('.table__cell--drag-over');
        if (prev) prev.classList.remove('table__cell--drag-over');

        if (el) {
            const cell = el.closest('.table__cell:not(.table__cell--outside-spacer)');
            if (cell && cell.dataset.betType) {
                cell.classList.add('table__cell--drag-over');
            }
        }
    }

    _dragEnd(e) {
        if (!this.dragClone) return;
        const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
        const y = e.clientY ?? e.changedTouches?.[0]?.clientY ?? 0;

        this.dragClone.remove();
        this.dragClone = null;

        // Remove drag state
        document.body.classList.remove('chip-dragging');
        this._highlightDropTargets(false);

        // Remove any lingering drag-over
        const dragOver = document.querySelector('.table__cell--drag-over');
        if (dragOver) dragOver.classList.remove('table__cell--drag-over');

        // Find the element under cursor
        const target = document.elementFromPoint(x, y);
        if (target) {
            const cell = target.closest('.table__cell:not(.table__cell--outside-spacer)');
            if (cell) cell.click(); // Trigger bet
        }
    }

    /* ── Drop Target Highlighting ── */

    _highlightDropTargets(show) {
        const cells = document.querySelectorAll('.table__cell[data-bet-type]');
        cells.forEach(cell => {
            if (cell.classList.contains('table__cell--outside-spacer')) return;
            if (show) {
                cell.classList.add('table__cell--drop-target');
            } else {
                cell.classList.remove('table__cell--drop-target');
            }
        });
    }

    /* ── Table Hover when chip selected ── */

    _setupTableHover() {
        const table = document.getElementById('rouletteTable');
        if (!table) return;

        table.addEventListener('mouseover', (e) => {
            if (this.selectedValue === null) return;
            const cell = e.target.closest('.table__cell:not(.table__cell--outside-spacer)');
            if (cell) cell.classList.add('table__cell--hover-chip');
        });

        table.addEventListener('mouseout', (e) => {
            const cell = e.target.closest('.table__cell');
            if (cell) cell.classList.remove('table__cell--hover-chip');
        });
    }
}

const casinoWheel = new CasinoWheel();
const chipManager = new ChipManager();
