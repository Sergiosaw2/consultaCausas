const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Client } = require('pg');

const ACCOUNTS_FILE = path.join(__dirname, '../accounts.json');

async function loadAccounts() {
  const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  return JSON.parse(data);
}

async function initDb() {
  const client = new Client({
    host: '192.168.1.56',
    port: 5433,
    database: 'PJN',
    user: 'postgres',
    password: 'solari'
  });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    lawyer TEXT,
    notification TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS access_log (
    id SERIAL PRIMARY KEY,
    lawyer TEXT,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  return client;
}

const PUPPETEER_OPTS = {
  headless: process.env.HEADLESS !== 'false',
  slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0
};

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
  await page.goto('https://example.com/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', account.username);
  await page.type('#password', account.password);
  await page.screenshot({ path: `login_${account.username}.png` });
  await page.click('#login');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  await db.query('INSERT INTO access_log (lawyer) VALUES ($1)', [account.username]);
  const notes = await fetchNotifications(page);
  for (const note of notes) {
    const res = await db.query('SELECT id FROM notifications WHERE lawyer=$1 AND notification=$2', [account.username, note]);
    if (res.rowCount === 0) {
      await db.query('INSERT INTO notifications (lawyer, notification) VALUES ($1, $2)', [account.username, note]);
      console.log('New notification saved:', note);
    }
  }
  await page.close();
}

(async () => {
  const accounts = await loadAccounts();
  const db = await initDb();
  const browser = await puppeteer.launch(PUPPETEER_OPTS);
  for (const acc of accounts) {
    try {
      await loginAndCheck(acc, db, browser);
    } catch (err) {
      console.error('Error processing account', acc.username, err);
    }
  }
  await browser.close();
  await db.end();
})();
