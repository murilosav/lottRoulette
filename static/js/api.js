/* ============================================
   API Service Layer - Roleta Casino
   Prepared for Django REST Framework integration
   ============================================ */

class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    /**
     * Get CSRF token from cookies (Django CSRF protection)
     */
    getCsrfToken() {
        const cookie = document.cookie
            .split(';')
            .find(c => c.trim().startsWith('csrftoken='));
        return cookie ? cookie.split('=')[1].trim() : '';
    }

    /**
     * Base request method with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken(),
            ...options.headers,
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new ApiError(
                    response.status,
                    errorData.detail || errorData.message || `Erro ${response.status}`
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError(0, 'Erro de conexão com o servidor');
        }
    }

    /* ── User Endpoints ── */

    async getProfile() {
        return this.request('/user/profile/');
    }

    async getBalance() {
        return this.request('/user/balance/');
    }

    async updateProfile(data) {
        return this.request('/user/profile/', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    /* ── Roulette Endpoints ── */

    async placeBet(color, amount) {
        return this.request('/roulette/bet/', {
            method: 'POST',
            body: JSON.stringify({ color, amount }),
        });
    }

    async getHistory(limit = 100) {
        return this.request(`/roulette/history/?limit=${limit}`);
    }

    async getCurrentRound() {
        return this.request('/roulette/current/');
    }

    async getRoundResult(roundId) {
        return this.request(`/roulette/round/${roundId}/`);
    }

    async getProvablyFair(roundId) {
        return this.request(`/roulette/fair/${roundId}/`);
    }
}

const api = new ApiService();
