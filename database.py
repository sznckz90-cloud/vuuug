import psycopg2
from config import DB_CONFIG

class Database:
    def __init__(self):
        self.connection = None
        self.connect()
    
    def connect(self):
        try:
            self.connection = psycopg2.connect(
                host=DB_CONFIG['host'],
                database=DB_CONFIG['database'],
                user=DB_CONFIG['user'],
                password=DB_CONFIG['password'],
                port=DB_CONFIG['port'],
                sslmode=DB_CONFIG['sslmode']
            )
            print("Database connection established")
        except Exception as e:
            print(f"Error connecting to database: {e}")
    
    # ... (rest of your Database class methods remain unchanged) ...