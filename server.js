const express = require('express'), Database = require('better-sqlite3'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), path = require('path');
const app = express(), db = new Database(path.join(__dirname, 'smartstock.db'));
const SECRET = process.env.JWT_SECRET || 'smartstock-dev-secret-change-me';
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(user_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(product_id INTEGER PRIMARY KEY AUTOINCREMENT, product_name TEXT NOT NULL, category TEXT NOT NULL,
  price REAL NOT NULL CHECK(price>=0), quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0), supplier_name TEXT,
  minimum_stock_level INTEGER NOT NULL DEFAULT 5 CHECK(minimum_stock_level>=0), user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS stock_transactions(transaction_id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN('Stock In','Stock Out')), quantity INTEGER NOT NULL CHECK(quantity>0),
  transaction_date TEXT NOT NULL DEFAULT (datetime('now','localtime')), description TEXT);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_product ON stock_transactions(product_id);`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => { try { fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong on the server. Please try again.' }); } };
const auth = (req, res, next) => { try { req.uid = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).uid; next(); } catch { res.status(401).json({ error: 'Please log in to continue.' }); } };
const pwOk = p => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const statusOf = p => p.quantity <= 0 ? 'Out of Stock' : p.quantity <= p.minimum_stock_level ? 'Low Stock' : 'In Stock';
const withStatus = p => ({ ...p, status: statusOf(p) });
const own = (id, uid) => db.prepare('SELECT * FROM products WHERE product_id=? AND user_id=?').get(id, uid);
const insTx = db.prepare('INSERT INTO stock_transactions(product_id,transaction_type,quantity,transaction_date,description) VALUES(?,?,?,COALESCE(?,datetime(\'now\',\'localtime\')),?)');

// ---------- sample data ----------
function seed(uid) {
  const items = [['Basmati Rice 5kg', 'Grains', 520, 'Sharma Traders', 10, 42], ['Toor Dal 1kg', 'Grains', 160, 'Sharma Traders', 10, 8], ['Atta 10kg', 'Grains', 410, 'Sharma Traders', 8, 25],
    ['Sunflower Oil 1L', 'Oils', 135, 'Ravi Distributors', 12, 0], ['Groundnut Oil 1L', 'Oils', 190, 'Ravi Distributors', 8, 14], ['Tata Salt 1kg', 'Essentials', 28, 'Ravi Distributors', 15, 60],
    ['Sugar 1kg', 'Essentials', 46, 'Lakshmi Wholesale', 15, 11], ['Tea Powder 250g', 'Beverages', 120, 'Lakshmi Wholesale', 10, 30], ['Parle-G Biscuits', 'Snacks', 10, 'Balaji Agencies', 30, 120],
    ['Maggi Noodles', 'Snacks', 14, 'Balaji Agencies', 30, 25], ['Bath Soap', 'Personal Care', 38, 'Balaji Agencies', 20, 70], ['Detergent 1kg', 'Household', 95, 'Lakshmi Wholesale', 10, 0],
    ['Milk 500ml', 'Dairy', 28, 'Local Dairy', 20, 35], ['Curd 400g', 'Dairy', 35, 'Local Dairy', 10, 6]];
  const addP = db.prepare('INSERT INTO products(product_name,category,price,quantity,supplier_name,minimum_stock_level,user_id) VALUES(?,?,?,?,?,?,?)');
  let s = 7; const rnd = (a, b) => { s = (s * 9301 + 49297) % 233280; return a + Math.floor(s / 233280 * (b - a + 1)); };
  const dateAt = (m, day) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m); d.setDate(day); return d.toISOString().slice(0, 10) + ' 10:30:00'; };
  db.transaction(() => items.forEach(([n, c, p, sup, min, target]) => {
    const pid = addP.run(n, c, p, target, sup, min, uid).lastInsertRowid; let net = 0;
    for (let m = 5; m >= 0; m--) { const out = rnd(3, 12), inn = out + rnd(2, 10); insTx.run(pid, 'Stock In', inn, dateAt(m, rnd(1, 12)), 'Supplier delivery'); insTx.run(pid, 'Stock Out', out, dateAt(m, rnd(13, 27)), 'Sold to customers'); net += inn - out; }
    const delta = target - net; if (delta > 0) insTx.run(pid, 'Stock In', delta, null, 'Supplier delivery'); else if (delta < 0) insTx.run(pid, 'Stock Out', -delta, null, 'Sold to customers');
  }))();
}

// ---------- auth ----------
const token = u => jwt.sign({ uid: u.user_id }, SECRET, { expiresIn: '7d' });
app.post('/api/auth/register', wrap((req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Enter your name and a valid email address.' });
  if (!pwOk(password)) return res.status(400).json({ error: 'Password needs at least 8 characters, including a letter and a number.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) return res.status(409).json({ error: 'This email is already registered. Try logging in.' });
  const id = db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10)).lastInsertRowid;
  seed(id); const u = { user_id: id, name: name.trim(), email: email.toLowerCase() };
  res.status(201).json({ token: token(u), user: { name: u.name, email: u.email } });
}));
app.post('/api/auth/login', wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password)) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: token(u), user: { name: u.name, email: u.email } });
}));

// ---------- products ----------
function clean(b) {
  const p = { product_name: String(b.product_name || '').trim(), category: String(b.category || '').trim(), price: Number(b.price), quantity: parseInt(b.quantity), supplier_name: String(b.supplier_name || '').trim(), minimum_stock_level: parseInt(b.minimum_stock_level) };
  if (!p.product_name || !p.category) return { error: 'Product name and category are required.' };
  if (!(p.price >= 0)) return { error: 'Enter a valid price.' };
  if (!(p.quantity >= 0)) return { error: 'Quantity cannot be negative.' };
  if (!(p.minimum_stock_level >= 0)) return { error: 'Enter a valid minimum stock level.' };
  return { p };
}
app.get('/api/products', auth, wrap((req, res) => res.json(db.prepare('SELECT * FROM products WHERE user_id=? ORDER BY product_name').all(req.uid).map(withStatus))));
app.post('/api/products', auth, wrap((req, res) => {
  const { p, error } = clean(req.body); if (error) return res.status(400).json({ error });
  const id = db.transaction(() => {
    const id = db.prepare('INSERT INTO products(product_name,category,price,quantity,supplier_name,minimum_stock_level,user_id) VALUES(?,?,?,?,?,?,?)').run(p.product_name, p.category, p.price, p.quantity, p.supplier_name, p.minimum_stock_level, req.uid).lastInsertRowid;
    if (p.quantity > 0) insTx.run(id, 'Stock In', p.quantity, null, 'Opening stock'); return id;
  })();
  res.status(201).json(withStatus(own(id, req.uid)));
}));
app.put('/api/products/:id', auth, wrap((req, res) => {
  const old = own(req.params.id, req.uid); if (!old) return res.status(404).json({ error: 'Product not found.' });
  const { p, error } = clean(req.body); if (error) return res.status(400).json({ error });
  db.transaction(() => {
    db.prepare('UPDATE products SET product_name=?,category=?,price=?,quantity=?,supplier_name=?,minimum_stock_level=? WHERE product_id=?').run(p.product_name, p.category, p.price, p.quantity, p.supplier_name, p.minimum_stock_level, old.product_id);
    const d = p.quantity - old.quantity; if (d) insTx.run(old.product_id, d > 0 ? 'Stock In' : 'Stock Out', Math.abs(d), null, 'Manual stock correction');
  })();
  res.json(withStatus(own(old.product_id, req.uid)));
}));
app.delete('/api/products/:id', auth, wrap((req, res) => {
  if (!own(req.params.id, req.uid)) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE product_id=?').run(req.params.id); res.json({ ok: true });
}));

// ---------- stock ----------
const stock = type => wrap((req, res) => {
  const pid = parseInt(req.body.product_id), q = parseInt(req.body.quantity), pr = own(pid, req.uid);
  if (!pr) return res.status(404).json({ error: 'Choose a product from your list.' });
  if (!(q > 0)) return res.status(400).json({ error: 'Enter a quantity greater than zero.' });
  if (type === 'Stock Out' && q > pr.quantity) return res.status(400).json({ error: `Only ${pr.quantity} in stock. You cannot sell more than that.` });
  db.transaction(() => {
    db.prepare('UPDATE products SET quantity=quantity+? WHERE product_id=?').run(type === 'Stock In' ? q : -q, pid);
    insTx.run(pid, type, q, null, String(req.body.description || '').slice(0, 200) || (type === 'Stock In' ? 'Stock received' : 'Sold'));
  })();
  res.json(withStatus(own(pid, req.uid)));
});
app.post('/api/stock/in', auth, stock('Stock In'));
app.post('/api/stock/out', auth, stock('Stock Out'));
app.get('/api/transactions', auth, wrap((req, res) => res.json(db.prepare(`SELECT t.*, p.product_name FROM stock_transactions t JOIN products p ON p.product_id=t.product_id
  WHERE p.user_id=? ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT ?`).all(req.uid, Math.min(parseInt(req.query.limit) || 100, 1000)))));

// ---------- alerts, dashboard, reports ----------
app.get('/api/alerts', auth, wrap((req, res) => res.json(db.prepare('SELECT * FROM products WHERE user_id=? AND quantity<=minimum_stock_level ORDER BY quantity ASC').all(req.uid).map(withStatus))));
const lastMonths = n => { const a = []; const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n + 1); for (let i = 0; i < n; i++) { a.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() + 1); } return a; };
const monthly = (uid, from, to) => db.prepare(`SELECT strftime('%Y-%m',t.transaction_date) m,
  SUM(CASE WHEN transaction_type='Stock In' THEN t.quantity ELSE 0 END) stock_in, SUM(CASE WHEN transaction_type='Stock Out' THEN t.quantity ELSE 0 END) stock_out,
  SUM(CASE WHEN transaction_type='Stock Out' THEN t.quantity*p.price ELSE 0 END) sales FROM stock_transactions t JOIN products p ON p.product_id=t.product_id
  WHERE p.user_id=? AND date(t.transaction_date) BETWEEN ? AND ? GROUP BY m ORDER BY m`).all(uid, from, to);
app.get('/api/dashboard', auth, wrap((req, res) => {
  const ps = db.prepare('SELECT * FROM products WHERE user_id=?').all(req.uid), u = req.uid;
  const cats = {}; ps.forEach(p => cats[p.category] = (cats[p.category] || 0) + 1);
  const months = lastMonths(6), rows = monthly(u, '0000-01-01', '9999-12-31'), by = Object.fromEntries(rows.map(r => [r.m, r]));
  res.json({ totalProducts: ps.length, totalStock: ps.reduce((s, p) => s + p.quantity, 0), lowStock: ps.filter(p => p.quantity > 0 && p.quantity <= p.minimum_stock_level).length,
    outOfStock: ps.filter(p => p.quantity === 0).length, inventoryValue: ps.reduce((s, p) => s + p.quantity * p.price, 0), categories: cats,
    availability: { 'In Stock': ps.filter(p => statusOf(p) === 'In Stock').length, 'Low Stock': ps.filter(p => statusOf(p) === 'Low Stock').length, 'Out of Stock': ps.filter(p => p.quantity === 0).length },
    months, movement: months.map(m => ({ stock_in: by[m]?.stock_in || 0, stock_out: by[m]?.stock_out || 0 })), sales: months.map(m => by[m]?.sales || 0),
    alerts: ps.filter(p => p.quantity <= p.minimum_stock_level).sort((a, b) => a.quantity - b.quantity).slice(0, 5).map(withStatus),
    recent: db.prepare(`SELECT t.*, p.product_name FROM stock_transactions t JOIN products p ON p.product_id=t.product_id WHERE p.user_id=? ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT 8`).all(u) });
}));
app.get('/api/reports', auth, wrap((req, res) => {
  const from = req.query.from || '0000-01-01', to = req.query.to || '9999-12-31', u = req.uid;
  const ps = db.prepare('SELECT * FROM products WHERE user_id=?').all(u).map(withStatus);
  const catMap = {}; ps.forEach(p => { const c = catMap[p.category] ||= { category: p.category, products: 0, quantity: 0, value: 0 }; c.products++; c.quantity += p.quantity; c.value += p.quantity * p.price; });
  res.json({ inventoryValue: ps.reduce((s, p) => s + p.quantity * p.price, 0), highest: [...ps].sort((a, b) => b.quantity - a.quantity).slice(0, 5), lowest: [...ps].sort((a, b) => a.quantity - b.quantity).slice(0, 5),
    categories: Object.values(catMap), monthly: monthly(u, from, to),
    transactions: db.prepare(`SELECT t.*, p.product_name FROM stock_transactions t JOIN products p ON p.product_id=t.product_id WHERE p.user_id=? AND date(t.transaction_date) BETWEEN ? AND ? ORDER BY t.transaction_date DESC, t.transaction_id DESC`).all(u, from, to) });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SmartStock running at http://localhost:${PORT}`));
