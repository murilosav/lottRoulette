/* ============================================
   Configuration - Roleta Casino
   ============================================ */

const CONFIG = {
    // Set to false when connecting to Django backend
    DEMO_MODE: true,

    // API Configuration
    API_BASE_URL: '/api',
    WS_BASE_URL: `ws://${window.location.host}/ws`,

    // Roulette Configuration
    ROULETTE: {
        // Number to color mapping (0-20)
        // 0 = White (Branco) - Pays 14x
        // 1-10 = Red (Vermelho) - Pays 2x
        // 11-20 = Black (Preto) - Pays 2x
        NUMBERS: {
            0: 'white',
            1: 'red', 2: 'red', 3: 'red', 4: 'red', 5: 'red', 6: 'red', 7: 'red', 8: 'red', 9: 'red', 10: 'red',
            11: 'black', 12: 'black', 13: 'black', 14: 'black', 15: 'black', 16: 'black', 17: 'black', 18: 'black', 19: 'black', 20: 'black'
        },

        // Sequence order on the spinning strip (alternates colors)
        SEQUENCE: [0, 1, 11, 2, 12, 3, 13, 4, 14, 5, 15, 6, 16, 7, 17, 8, 18, 9, 19, 10, 20],

        // How many times to repeat the sequence in the strip
        STRIP_REPETITIONS: 7,

        // Visual dimensions (in px)
        ITEM_SIZE: 80,
        ITEM_GAP: 10,

        // Timing (in ms)
        SPIN_DURATION: 6000,
        RESULT_DISPLAY_TIME: 4000,
    },

    // Betting Configuration
    BETTING: {
        MIN_BET: 0.01,
        MAX_PAYOUT: 20000,
        MULTIPLIERS: {
            red: 2,
            black: 2,
            white: 14,
            straight: 14,  // Single number bet
            odd: 2,
            even: 2
        },
        BETTING_TIME: 15, // seconds
    },

    // Display
    MAX_PREVIOUS_ROLLS: 20,
    MAX_STATS_ROLLS: 100,

    // Color names in Portuguese
    COLOR_NAMES: {
        red: 'Vermelho',
        white: 'Branco',
        black: 'Preto'
    },

    // Demo players for demo mode
    DEMO_PLAYERS: [
        'xGamer_Pro', 'LuckyShot77', 'RoletaKing', 'Apostador777',
        'HighRoller_', 'CryptoWolf', 'DiamondH4nd', 'BetMaster99',
        'NovaStrike', 'PhoenixBet', 'ThunderPlay', 'SilverFox_X',
        'GoldenEagle', 'ShadowBet', 'NightOwl99', 'StarPlayer',
        'IronClad_42', 'VelvetAce', 'NeonDrift88', 'SkyHighBet',
        'RubyStorm', 'JackpotJoe', 'AceOfSpade', 'MrLucky2024',
        'DarkKnight7', 'BlazeFire', 'RocketBet', 'ZeusPlay',
        'TitaniumX', 'OmegaRoll', 'CobraStrike', 'ViperBet88'
    ],
};
