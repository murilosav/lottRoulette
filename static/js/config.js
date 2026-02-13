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
        // Number to color mapping (0-14)
        // 0 = White (Branco) - Pays 20x
        // 1-7 = Red (Vermelho) - Pays 2x
        // 8-14 = Black (Preto) - Pays 2x
        NUMBERS: {
            0: 'white',
            1: 'red', 2: 'red', 3: 'red', 4: 'red', 5: 'red', 6: 'red', 7: 'red',
            8: 'black', 9: 'black', 10: 'black', 11: 'black', 12: 'black', 13: 'black', 14: 'black'
        },

        // Sequence order on the spinning strip (alternates colors)
        SEQUENCE: [0, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12, 6, 13, 7, 14],

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
            white: 20
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
