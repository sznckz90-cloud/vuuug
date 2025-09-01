# Bot configuration
BOT_TOKEN = "7561099955:AAGZcVgDyWJ3CZ-gvFSNxicTGvJDFojNjug"
ADMIN_ID = 6653616672
CHANNEL_ID = -1002480439556
SUPPORT_LINK = "https://t.me/szxzyz"
CHANNEL_LINK = "https://t.me/LightingSats"
WEBAPP_URL = "https://lighting-sats-app.onrender.com"

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'database': 'lightning_sats',
    'user': 'postgres',
    'password': 'password',
    'port': 5432
}

# Payment methods configuration
PAYMENT_METHODS = {
    'telegram_stars': {
        'name': 'Telegram Stars',
        'min_amount': 0.75,
        'commission_percent': 2.0,
        'commission_fixed': 0,
        'currency': 'USD'
    },
    'crypto_bot': {
        'name': 'Crypto Bot',
        'min_amount': 0.07,
        'commission_percent': 3.0,
        'commission_fixed': 0,
        'currency': 'USD'
    },
    'usdt_bep20': {
        'name': 'Tether (USDT-BEP-20)',
        'min_amount': 2.00,
        'commission_percent': 0,
        'commission_fixed': 1.0,
        'currency': 'USD'
    },
    'tron': {
        'name': 'Tron (TRX)',
        'min_amount': 2.3302,
        'commission_percent': 0,
        'commission_fixed': 2.0,
        'currency': 'TRX'
    },
    'litecoin': {
        'name': 'Litecoin (LTC)',
        'min_amount': 1.20,
        'commission_percent': 0,
        'commission_fixed': 0.001,
        'currency': 'LTC'
    },
    'bitcoin_cash': {
        'name': 'Bitcoin Cash (BCH)',
        'min_amount': 5.8740,
        'commission_percent': 0,
        'commission_fixed': 0.001,
        'currency': 'BCH'
    },
    'dash': {
        'name': 'Dash (DAA)',
        'min_amount': 0.4918,
        'commission_percent': 0,
        'commission_fixed': 0.01,
        'currency': 'DAA'
    },
    'dogecoin': {
        'name': 'Dogecoin (DOG)',
        'min_amount': 7.9464,
        'commission_percent': 0,
        'commission_fixed': 8.0,
        'currency': 'DOG'
    },
    'ripple': {
        'name': 'Ripple (XRP)',
        'min_amount': 70.47,
        'commission_percent': 0,
        'commission_fixed': 0.25,
        'currency': 'XRP'
    }
}

# Earning configuration
PER_AD_REWARD = 0.00024
STREAK_BONUS = 0.002
DAILY_GOAL = 250