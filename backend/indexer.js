const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

const SEARCH_ROOT = process.env.SEARCH_ROOT || 'S:\\';
const INDEX_LIMIT_FILES = Number(process.env.INDEX_LIMIT_FILES || 5000);
const INDEX_MAX_FILE_SIZE = Number(process.env.INDEX_MAX_FILE_SIZE || 2 * 1024 * 1024);
const INDEX_REFRESH_MS = Number(process.env.INDEX_REFRESH_MS || 5 * 60 * 1000);

function resolveSearchRoot() {
  if (SEARCH_ROOT && fs.existsSync(SEARCH_ROOT)) return SEARCH_ROOT;
  const docs = path.join(os.homedir(), 'Documents');
  if (fs.existsSync(docs)) return docs;
  return os.homedir();
}

function scoreText(text, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const base = text.toLowerCase();
  return tokens.reduce((acc, t) => acc + (base.includes(t) ? 1 : 0), 0);
}

class DataIndexer {
  constructor() {
    this.index = [];
    this.lastRunAt = null;
    this.running = false;
    this.lastError = null;
    this.timer = null;
  }

  startAutoRefresh() {
    if (this.timer) clearInterval(this.timer);
    this.refresh();
    this.timer = setInterval(() => this.refresh(), INDEX_REFRESH_MS);
  }

  refresh() {
    if (this.running) return;
    this.running = true;

    try {
      const root = resolveSearchRoot();
      const results = [];
      this.walk(root, results);
      this.index = results;
      this.lastRunAt = new Date().toISOString();
      this.lastError = null;
      console.log(`[indexer] indexados ${results.length} registros`);
    } catch (err) {
      this.lastError = err.message;
      console.error('[indexer] erro ao indexar', err);
    } finally {
      this.running = false;
    }
  }

  walk(dir, out) {
    if (out.length >= INDEX_LIMIT_FILES) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      if (out.length >= INDEX_LIMIT_FILES) break;
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        this.walk(full, out);
        continue;
      }
      out.push(...this.extractFile(full, stat));
    }
  }

  extractFile(filePath, stat) {
    const ext = path.extname(filePath).toLowerCase();
    const rows = [];
    if (ext === '.sqlite' || ext === '.db') {
      return this.extractSqlite(filePath);
    }
    if (ext === '.xlsx' || ext === '.xls') {
      return this.extractExcel(filePath);
    }
    if (ext === '.json') {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        rows.push({ source: filePath, type: 'json', table: 'root', content: JSON.stringify(parsed).slice(0, 4000) });
      } catch {}
      return rows;
    }
    if (ext === '.csv' || ext === '.txt' || ext === '.pdf') {
      const content = stat.size <= INDEX_MAX_FILE_SIZE ? fs.readFileSync(filePath, 'utf8').slice(0, 4000) : `[arquivo grande: ${stat.size} bytes]`;
      rows.push({ source: filePath, type: ext.slice(1), table: 'file', content });
      return rows;
    }
    return [{ source: filePath, type: 'file', table: 'file', content: path.basename(filePath) }];
  }

  extractSqlite(filePath) {
    const rows = [];
    let db;
    try {
      db = new Database(filePath, { readonly: true, fileMustExist: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      for (const t of tables.slice(0, 30)) {
        const table = t.name;
        try {
          const data = db.prepare(`SELECT * FROM \"${table}\" LIMIT 100`).all();
          for (const row of data) {
            rows.push({ source: filePath, type: 'sqlite', table, content: JSON.stringify(row).slice(0, 4000) });
          }
        } catch {}
      }
    } catch {}
    if (db) db.close();
    return rows;
  }

  extractExcel(filePath) {
    const rows = [];
    try {
      const wb = XLSX.readFile(filePath);
      for (const sheet of wb.SheetNames.slice(0, 20)) {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null }).slice(0, 200);
        for (const row of data) {
          rows.push({ source: filePath, type: 'excel', table: sheet, content: JSON.stringify(row).slice(0, 4000) });
        }
      }
    } catch {}
    return rows;
  }

  search(query, limit = 30) {
    const scored = this.index
      .map((item) => ({ ...item, score: scoreText(`${item.table} ${item.content} ${item.source}`, query) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored;
  }

  status() {
    return {
      root: resolveSearchRoot(),
      indexSize: this.index.length,
      lastRunAt: this.lastRunAt,
      running: this.running,
      lastError: this.lastError,
    };
  }
}

module.exports = { DataIndexer, resolveSearchRoot };
