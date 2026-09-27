import sqlite3,os,sys

db=os.path.join(os.getcwd(),'future.db')
if not os.path.exists(db):
    print('Database file not found:', db)
    sys.exit(1)
conn=sqlite3.connect(db)
cur=conn.cursor()
cur.execute('PRAGMA table_info(users)')
cols=[r[1] for r in cur.fetchall()]
print('Existing columns:', cols)
if 'role' in cols:
    print('Column role already exists; no change needed')
else:
    try:
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student' NOT NULL")
        conn.commit()
        print('Added column role to users table')
    except Exception as e:
        print('Failed to add column:', e)
        sys.exit(2)
conn.close()
