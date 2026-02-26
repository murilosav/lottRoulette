/* ============================================
   Live Chat - Demo simulation
   ============================================ */

class ChatManager {
    constructor() {
        this.container = null;
        this.messagesList = null;
        this.input = null;
        this.messages = [];
        this.demoInterval = null;

        this.demoMessages = [
            'boa sorte galera!', 'vermelho vai sair', 'branco vem hoje',
            'all in no preto', 'alguém mais no branco?', 'vamo q vamo!',
            'perdi tudo kk', 'hj é dia de lucro', 'gg',
            '20x no branco vai vir', 'preto nunca decepciona', 'quem tá no vermelho?',
            'bora bora', 'tá pago!', 'saiu vermelho dnv??',
            'preto sequencia', 'saldo tá indo embora kk', 'hj tô on fire',
            'alguém sabe o padrão?', 'aposta segura: preto',
            'vermelho 3x seguidas', 'já era meu saldo',
            'branco paga 20x galera', 'confia no processo',
            'mais alguém all in?', 'dessa vez vai!',
            'quase saiu branco', 'eita rapaz', 'boa!!',
            'vou no vermelho dnv', 'preto é vida',
        ];
    }

    init() {
        this.container = document.getElementById('gameChat');
        this.messagesList = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        if (!this.container) return;

        this._setupInput();
        this._setupToggle();

        if (CONFIG.DEMO_MODE) {
            this._startDemoChat();
        }
    }

    _setupToggle() {
        const toggle = document.getElementById('chatToggleBtn');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.container.classList.toggle('chat--open');
                // Clear badge
                const badge = toggle.querySelector('.chat-toggle__badge');
                if (badge) badge.style.display = 'none';
            });
        }
    }

    _setupInput() {
        const sendBtn = document.getElementById('chatSend');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this._sendUserMessage());
        }
        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this._sendUserMessage();
            });
        }
    }

    _sendUserMessage() {
        if (!this.input || !this.input.value.trim()) return;
        const text = this.input.value.trim();
        this.input.value = '';
        const username = app?.userProfile?.username || 'Você';
        this.addMessage(username, text, true);
    }

    addMessage(username, text, isSelf = false) {
        const msg = { username, text, isSelf, time: new Date() };
        this.messages.push(msg);
        if (this.messages.length > 150) this.messages.shift();
        this._renderMessage(msg);

        // Show unread badge if chat is closed
        if (!isSelf && this.container && !this.container.classList.contains('chat--open')) {
            const badge = document.querySelector('.chat-toggle__badge');
            if (badge) {
                badge.style.display = 'flex';
                const count = parseInt(badge.textContent || '0') + 1;
                badge.textContent = count > 99 ? '99+' : count;
            }
        }
    }

    _renderMessage(msg) {
        if (!this.messagesList) return;
        const el = document.createElement('div');
        el.className = `chat__msg${msg.isSelf ? ' chat__msg--self' : ''}${msg.isSystem ? ' chat__msg--system' : ''}`;

        const time = msg.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (msg.isSystem) {
            el.innerHTML = `<span class="chat__msg-text">${msg.text}</span>`;
        } else {
            el.innerHTML = `
                <span class="chat__msg-time">${time}</span>
                <span class="chat__msg-user">${this._esc(msg.username)}</span>
                <span class="chat__msg-text">${this._esc(msg.text)}</span>
            `;
        }

        this.messagesList.appendChild(el);

        // Keep scroll at bottom
        this.messagesList.scrollTop = this.messagesList.scrollHeight;

        // Limit rendered messages
        while (this.messagesList.children.length > 100) {
            this.messagesList.removeChild(this.messagesList.firstChild);
        }
    }

    addSystemMessage(text) {
        const msg = { username: '', text, isSelf: false, isSystem: true, time: new Date() };
        this.messages.push(msg);
        this._renderMessage(msg);
    }

    /* ── Game event reactions ── */

    onResult(number, color) {
        const names = CONFIG.DEMO_PLAYERS;
        const colorName = CONFIG.COLOR_NAMES[color];
        this.addSystemMessage(`Resultado: <strong>${number}</strong> — ${colorName}`);

        const reactions = {
            white: ['BRANCO!!!', '20x SAIU!!!', 'QUEM APOSTOU TÁ RICO', 'OMG BRANCO!!!', 'não acredito'],
            red: ['vermelho dnv', 'boa! vermelho!', 'falei q ia sair', 'eita vermelho'],
            black: ['preto certeiro', 'preto vem sempre', 'previsível kk', 'preto de novo']
        };
        const pool = reactions[color] || reactions.red;
        const count = 1 + Math.floor(Math.random() * 2);

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const name = names[Math.floor(Math.random() * names.length)];
                const text = pool[Math.floor(Math.random() * pool.length)];
                this.addMessage(name, text);
            }, 800 + i * 2000 + Math.random() * 1500);
        }
    }

    onBigWin(username, amount) {
        this.addSystemMessage(`<strong>${this._esc(username)}</strong> ganhou <strong>R$ ${amount.toFixed(2)}</strong>!`);
    }

    /* ── Demo chat ── */

    _startDemoChat() {
        const names = CONFIG.DEMO_PLAYERS;

        // Initial messages
        setTimeout(() => this.addMessage(names[0], 'eae galera! bora apostar'), 800);
        setTimeout(() => this.addMessage(names[5], 'boa noite!'), 2200);
        setTimeout(() => this.addMessage(names[2], 'hj vou lucrar'), 3800);

        // Periodic messages
        this.demoInterval = setInterval(() => {
            if (Math.random() > 0.5) return;
            const name = names[Math.floor(Math.random() * names.length)];
            const text = this.demoMessages[Math.floor(Math.random() * this.demoMessages.length)];
            this.addMessage(name, text);
        }, 5000 + Math.random() * 8000);
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
}

const chatManager = new ChatManager();
