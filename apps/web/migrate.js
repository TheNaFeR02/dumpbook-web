const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = path.join(process.cwd(), 'data', 'auth.sqlite')
const migrationsDir = path.join(__dirname, 'migrations')

const db = new Database(dbPath)

db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')

const applied = new Set(
  db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
)

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  if (applied.has(file)) {
    console.log(`[migrate] skip: ${file}`)
    continue
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
  db.exec(sql)
  db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
  console.log(`[migrate] applied: ${file}`)
}

db.close()
