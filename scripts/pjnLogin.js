const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sqlite3 = require('sqlite3').verbose();

const ACCOUNTS_FILE = path.join(__dirname, '../accounts.json');
const DB_PATH = path.join(__dirname, '../data.db');

async function loadAccounts() {
  const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  return JSON.parse(data);
}

function initDb() {
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lawyer TEXT,
      notification TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lawyer TEXT,
      access_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
  return db;
}

async function fetchNotifications(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.notification'))
      .map(el => el.innerText.trim())
      .filter(Boolean);
  });
}

async function loginAndCheck(account, db, browser) {
  const page = await browser.newPage();
  console.log(`Logging in as ${account.username}`);
  await page.goto('https://example.com/login');
  await page.type('#username', account.username);
  await page.type('#password', account.password);
  await page.click('#login');
  await page.waitForNavigation();
  db.run('INSERT INTO access_log (lawyer) VALUES (?)', [account.username]);
  const notes = await fetchNotifications(page);
  for (const note of notes) {
    await new Promise((resolve, reject) => {
      db.get('SELECT id FROM notifications WHERE lawyer=? AND notification=?', [account.username, note], (err, row) => {
        if (err) return reject(err);
        if (!row) {
          db.run('INSERT INTO notifications (lawyer, notification) VALUES (?, ?)', [account.username, note]);
          console.log('New notification saved:', note);
        }
        resolve();
      });
    });
  }
  await page.close();
}

(async () => {
  const accounts = await loadAccounts();
  const db = initDb();
  const browser = await puppeteer.launch();
  for (const acc of accounts) {
    try {
      await loginAndCheck(acc, db, browser);
    } catch (err) {
      console.error('Error processing account', acc.username, err);
    }
  }
  await browser.close();
  db.close();
})();
