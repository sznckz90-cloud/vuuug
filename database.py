import psycopg2
from config import DB_CONFIG
from datetime import datetime, timedelta

class Database:
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        try:
            self.connection = psycopg2.connect(**DB_CONFIG)
            print("Database connection established")
        except Exception as e:
            print(f"Error connecting to database: {e}")
    
    def create_tables(self):
        try:
            with self.connection.cursor() as cursor:
                # Users table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        telegram_id BIGINT UNIQUE NOT NULL,
                        username VARCHAR(255),
                        first_name VARCHAR(255),
                        last_name VARCHAR(255),
                        language VARCHAR(10) DEFAULT 'en',
                        balance DECIMAL(15, 8) DEFAULT 0,
                        hold_balance DECIMAL(15, 8) DEFAULT 0,
                        earned_today DECIMAL(15, 8) DEFAULT 0,
                        earned_total DECIMAL(15, 8) DEFAULT 0,
                        watched_today INTEGER DEFAULT 0,
                        streak INTEGER DEFAULT 0,
                        streak_multiplier DECIMAL(5, 4) DEFAULT 1.0,
                        is_subscribed BOOLEAN DEFAULT FALSE,
                        referral_code VARCHAR(10) UNIQUE,
                        referred_by INTEGER REFERENCES users(id),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_streak_claim DATE
                    )
                """)
                
                # Withdrawals table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS withdrawals (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        method VARCHAR(50) NOT NULL,
                        amount DECIMAL(15, 8) NOT NULL,
                        address TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Referrals table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS referrals (
                        id SERIAL PRIMARY KEY,
                        referrer_id INTEGER REFERENCES users(id),
                        referred_id INTEGER REFERENCES users(id) UNIQUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Ad views table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ad_views (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        ad_type VARCHAR(50) NOT NULL,
                        reward DECIMAL(15, 8) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Contest submissions table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS contest_submissions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id),
                        contest_type VARCHAR(50) NOT NULL,
                        link TEXT NOT NULL,
                        status VARCHAR(20) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                self.connection.commit()
                print("Tables created successfully")
        except Exception as e:
            print(f"Error creating tables: {e}")
    
    def get_user(self, telegram_id):
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM users WHERE telegram_id = %s",
                    (telegram_id,)
                )
                user = cursor.fetchone()
                return user
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def create_user(self, telegram_id, username, first_name, last_name, referral_code=None, referred_by=None):
        try:
            with self.connection.cursor() as cursor:
                # Generate a unique referral code if not provided
                if not referral_code:
                    referral_code = f"ref{telegram_id}"[-10:]
                
                cursor.execute(
                    """INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by) 
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                    (telegram_id, username, first_name, last_name, referral_code, referred_by)
                )
                user_id = cursor.fetchone()[0]
                
                # If this user was referred by someone, create a referral record
                if referred_by:
                    cursor.execute(
                        "INSERT INTO referrals (referrer_id, referred_id) VALUES (%s, %s)",
                        (referred_by, user_id)
                    )
                
                self.connection.commit()
                return user_id
        except Exception as e:
            print(f"Error creating user: {e}")
            return None
    
    def update_user_language(self, telegram_id, language):
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET language = %s WHERE telegram_id = %s",
                    (language, telegram_id)
                )
                self.connection.commit()
                return True
        except Exception as e:
            print(f"Error updating user language: {e}")
            return False
    
    def update_user_subscription(self, telegram_id, is_subscribed):
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET is_subscribed = %s WHERE telegram_id = %s",
                    (is_subscribed, telegram_id)
                )
                self.connection.commit()
                return True
        except Exception as e:
            print(f"Error updating user subscription: {e}")
            return False
    
    def add_ad_view(self, telegram_id, reward):
        try:
            with self.connection.cursor() as cursor:
                # Get user's current values
                cursor.execute(
                    "SELECT watched_today, earned_today, earned_total, hold_balance FROM users WHERE telegram_id = %s",
                    (telegram_id,)
                )
                user_data = cursor.fetchone()
                
                if user_data:
                    watched_today, earned_today, earned_total, hold_balance = user_data
                    
                    # Update user's stats
                    cursor.execute(
                        """UPDATE users SET 
                        watched_today = watched_today + 1,
                        earned_today = earned_today + %s,
                        earned_total = earned_total + %s,
                        hold_balance = hold_balance + %s,
                        last_active = CURRENT_TIMESTAMP
                        WHERE telegram_id = %s""",
                        (reward, reward, reward, telegram_id)
                    )
                    
                    # Add to ad views table
                    cursor.execute(
                        "INSERT INTO ad_views (user_id, ad_type, reward) VALUES (%s, %s, %s)",
                        (telegram_id, 'monetag', reward)
                    )
                    
                    self.connection.commit()
                    return True
                return False
        except Exception as e:
            print(f"Error adding ad view: {e}")
            return False
    
    def claim_streak(self, telegram_id):
        try:
            with self.connection.cursor() as cursor:
                # Get user's current streak and last claim date
                cursor.execute(
                    "SELECT streak, last_streak_claim, streak_multiplier FROM users WHERE telegram_id = %s",
                    (telegram_id,)
                )
                user_data = cursor.fetchone()
                
                if user_data:
                    streak, last_streak_claim, streak_multiplier = user_data
                    today = datetime.now().date()
                    
                    # Check if user already claimed streak today
                    if last_streak_claim and last_streak_claim == today:
                        return False, "Already claimed today"
                    
                    # Calculate new streak
                    if last_streak_claim and (today - last_streak_claim).days == 1:
                        new_streak = streak + 1
                    else:
                        new_streak = 1
                    
                    # Calculate new multiplier (capped at 2.0)
                    new_multiplier = min(1.0 + (new_streak * 0.002), 2.0)
                    
                    # Calculate bonus
                    bonus = STREAK_BONUS * new_multiplier
                    
                    # Update user's stats
                    cursor.execute(
                        """UPDATE users SET 
                        streak = %s,
                        streak_multiplier = %s,
                        earned_today = earned_today + %s,
                        earned_total = earned_total + %s,
                        hold_balance = hold_balance + %s,
                        last_streak_claim = %s,
                        last_active = CURRENT_TIMESTAMP
                        WHERE telegram_id = %s""",
                        (new_streak, new_multiplier, bonus, bonus, bonus, today, telegram_id)
                    )
                    
                    self.connection.commit()
                    return True, bonus
                return False, "User not found"
        except Exception as e:
            print(f"Error claiming streak: {e}")
            return False, str(e)
    
    def get_user_stats(self, telegram_id):
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """SELECT 
                    telegram_id, username, first_name, last_name,
                    balance, hold_balance, earned_today, earned_total,
                    watched_today, streak, streak_multiplier, is_subscribed,
                    referral_code, created_at
                    FROM users WHERE telegram_id = %s""",
                    (telegram_id,)
                )
                user_data = cursor.fetchone()
                
                if user_data:
                    # Calculate days with us
                    created_at = user_data[13]
                    days_with_us = (datetime.now() - created_at).days
                    
                    # Get referral count
                    cursor.execute(
                        "SELECT COUNT(*) FROM referrals WHERE referrer_id = (SELECT id FROM users WHERE telegram_id = %s)",
                        (telegram_id,)
                    )
                    referral_count = cursor.fetchone()[0]
                    
                    return {
                        'telegram_id': user_data[0],
                        'username': user_data[1],
                        'first_name': user_data[2],
                        'last_name': user_data[3],
                        'balance': user_data[4],
                        'hold_balance': user_data[5],
                        'earned_today': user_data[6],
                        'earned_total': user_data[7],
                        'watched_today': user_data[8],
                        'streak': user_data[9],
                        'streak_multiplier': user_data[10],
                        'is_subscribed': user_data[11],
                        'referral_code': user_data[12],
                        'days_with_us': days_with_us,
                        'referral_count': referral_count
                    }
                return None
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return None
    
    def create_withdrawal(self, telegram_id, method, amount, address):
        try:
            with self.connection.cursor() as cursor:
                # Get user's current balance
                cursor.execute(
                    "SELECT balance FROM users WHERE telegram_id = %s",
                    (telegram_id,)
                )
                balance = cursor.fetchone()[0]
                
                if balance < amount:
                    return False, "Insufficient balance"
                
                # Deduct from balance
                cursor.execute(
                    "UPDATE users SET balance = balance - %s WHERE telegram_id = %s",
                    (amount, telegram_id)
                )
                
                # Create withdrawal record
                cursor.execute(
                    """INSERT INTO withdrawals (user_id, method, amount, address) 
                    VALUES ((SELECT id FROM users WHERE telegram_id = %s), %s, %s, %s)""",
                    (telegram_id, method, amount, address)
                )
                
                self.connection.commit()
                return True, "Withdrawal request created successfully"
        except Exception as e:
            print(f"Error creating withdrawal: {e}")
            return False, str(e)
    
    def get_referral_stats(self, telegram_id):
        try:
            with self.connection.cursor() as cursor:
                # Get user ID
                cursor.execute(
                    "SELECT id FROM users WHERE telegram_id = %s",
                    (telegram_id,)
                )
                user_id = cursor.fetchone()[0]
                
                # Total referrals
                cursor.execute(
                    "SELECT COUNT(*) FROM referrals WHERE referrer_id = %s",
                    (user_id,)
                )
                total_referrals = cursor.fetchone()[0]
                
                # Referrals who watched at least one ad
                cursor.execute(
                    """SELECT COUNT(DISTINCT r.referred_id) 
                    FROM referrals r 
                    JOIN ad_views a ON r.referred_id = a.user_id 
                    WHERE r.referrer_id = %s""",
                    (user_id,)
                )
                active_referrals = cursor.fetchone()[0]
                
                # New referrals in last 30 days
                cursor.execute(
                    """SELECT COUNT(*) FROM referrals 
                    WHERE referrer_id = %s AND created_at >= NOW() - INTERVAL '30 days'""",
                    (user_id,)
                )
                new_referrals_30 = cursor.fetchone()[0]
                
                # New active referrals in last 30 days
                cursor.execute(
                    """SELECT COUNT(DISTINCT r.referred_id) 
                    FROM referrals r 
                    JOIN ad_views a ON r.referred_id = a.user_id 
                    WHERE r.referrer_id = %s AND r.created_at >= NOW() - INTERVAL '30 days'""",
                    (user_id,)
                )
                new_active_referrals_30 = cursor.fetchone()[0]
                
                # Profit from all referrals in last 30 days
                cursor.execute(
                    """SELECT COALESCE(SUM(a.reward * 0.2), 0) 
                    FROM ad_views a 
                    JOIN referrals r ON a.user_id = r.referred_id 
                    WHERE r.referrer_id = %s AND a.created_at >= NOW() - INTERVAL '30 days'""",
                    (user_id,)
                )
                profit_30 = cursor.fetchone()[0] or 0
                
                # Profit from new referrals in last 30 days
                cursor.execute(
                    """SELECT COALESCE(SUM(a.reward * 0.2), 0) 
                    FROM ad_views a 
                    JOIN referrals r ON a.user_id = r.referred_id 
                    WHERE r.referrer_id = %s AND r.created_at >= NOW() - INTERVAL '30 days' 
                    AND a.created_at >= NOW() - INTERVAL '30 days'""",
                    (user_id,)
                )
                new_profit_30 = cursor.fetchone()[0] or 0
                
                return {
                    'total_referrals': total_referrals,
                    'active_referrals': active_referrals,
                    'new_referrals_30': new_referrals_30,
                    'new_active_referrals_30': new_active_referrals_30,
                    'profit_30': profit_30,
                    'new_profit_30': new_profit_30
                }
        except Exception as e:
            print(f"Error getting referral stats: {e}")
            return None
    
    def reset_daily_stats(self):
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET watched_today = 0, earned_today = 0"
                )
                self.connection.commit()
                return True
        except Exception as e:
            print(f"Error resetting daily stats: {e}")
            return False

# Create a global database instance
db = Database()