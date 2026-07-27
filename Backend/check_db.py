import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

try:
    conn = psycopg2.connect(
        dbname='postgres',
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute("SELECT datname FROM pg_database;")
    dbs = cursor.fetchall()
    print('Available databases:')
    for db in dbs:
        print(f'  - {db[0]}')

    # Check if tenant_lavanya exists
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'tenant_lavanya'")
    exists = cursor.fetchone()
    if not exists:
        print("\nCreating tenant_lavanya database...")
        cursor.execute("CREATE DATABASE tenant_lavanya;")
        print("✅ Database tenant_lavanya created!")
    else:
        print("\n✅ tenant_lavanya database already exists!")

    cursor.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")