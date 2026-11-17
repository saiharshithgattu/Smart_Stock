const $ = s => document.querySelector(s), app = $('#app');
let token = localStorage.getItem('ss_token'), user = JSON.parse(localStorage.getItem('ss_user') || 'null'), charts = [], products = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const badge = s => `<span class="badge ${s === 'In Stock' ? 'b-in' : s === 'Low Stock' ? 'b-low' : 'b-out'}">${s}</span>`;
const empty = (icon, msg) => `<div class="empty"><i class="fa-solid ${icon}"></i>${msg}</div>`;

function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 3500); }
async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && token && !url.startsWith('/auth')) { logout(); throw new Error('Your session ended. Please log in again.'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong.'); return d;
}
function logout() { token = null; user = null; localStorage.removeItem('ss_token'); localStorage.removeItem('ss_user'); location.hash = '#/login'; }
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; }
function closeModal() { $('#modal').hidden = true; }
function confirmBox(msg) { return new Promise(res => { modal(`<h3>Are you sure?</h3><p>${msg}</p><div class="acts"><button class="btn ghost" id="cn">Cancel</button><button class="btn" id="cy">Yes, delete</button></div>`); $('#cn').onclick = () => { closeModal(); res(false); }; $('#cy').onclick = () => { closeModal(); res(true); }; }); }
function drawChart(id, type, labels, datasets, opts = {}) { const c = new Chart($(id), { type, data: { labels, datasets }, options: { responsive: true, plugins: { legend: { display: datasets.length > 1 || type === 'doughnut' } }, ...opts } }); charts.push(c); }
const COLORS = ['#C51F26', '#F5662B', '#E8A33D', '#555555', '#2e8b57', '#8c5a3c', '#b0b0b0'];
const mLabel = m => new Date(m + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' });

// ---------- nav & router ----------
const pages = { '': home, dashboard, inventory, stock, alerts, reports, about, login };
const protectedPages = ['dashboard', 'inventory', 'stock', 'alerts', 'reports'];
function renderNav(cur) {
  const links = [['', 'Home'], ['dashboard', 'Dashboard'], ['inventory', 'Inventory'], ['stock', 'Stock'], ['alerts', 'Alerts'], ['reports', 'Reports'], ['about', 'About']];
  $('#nav').innerHTML = links.map(([h, t]) => `<a href="#/${h}" class="${cur === h ? 'on' : ''}">${t}</a>`).join('') + (token ? `<a href="#" id="lo"><i class="fa-solid fa-right-from-bracket"></i> Logout (${esc(user?.name.split(' ')[0])})</a>` : `<a href="#/login" class="${cur === 'login' ? 'on' : ''}">Login</a>`);
  $('#nav').classList.remove('open'); const lo = $('#lo'); if (lo) lo.onclick = e => { e.preventDefault(); logout(); toast('You are logged out.'); };
}
async function route() {
  charts.forEach(c => c.destroy()); charts = [];
  const p = (location.hash.replace(/^#\/?/, '') || '');
  const name = p in pages ? p : '';
  if (protectedPages.includes(name) && !token) { location.hash = '#/login'; return; }
  renderNav(name); window.scrollTo(0, 0);
  app.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Loading…</p></div>';
  try { await pages[name](); } catch (e) { if (location.hash.includes(name)) app.innerHTML = empty('fa-triangle-exclamation', esc(e.message)); }
}
$('#burger').onclick = () => $('#nav').classList.toggle('open');
window.addEventListener('hashchange', route);

// ---------- home ----------
function home() {
  const feats = [['fa-bell', 'Low-stock alerts', 'Know what is running out before a customer asks for it.'], ['fa-arrow-right-arrow-left', 'Stock in and out', 'Record every delivery and sale. Stock never goes below zero.'], ['fa-chart-pie', 'Clear dashboard', 'See stock value, categories and monthly trends at a glance.'], ['fa-file-csv', 'Reports you can keep', 'Pick dates and download your records as CSV.'], ['fa-mobile-screen', 'Works on any screen', 'Use it on the shop counter computer or your phone.'], ['fa-lock', 'Your store only', 'Every shop has its own login and its own inventory.']];
  app.innerHTML = `<section class="hero"><div><h1>Manage Your Store Inventory Smarter, Faster, and Easier.</h1>
    <p>SmartStock replaces the stock register with a simple screen. Track every item, get warned before shelves go empty, and stop losing sales to stockouts.</p>
    <div class="row"><a class="btn" href="#/${token ? 'dashboard' : 'login'}">Get Started</a><a class="btn ghost" href="#features">Explore Features</a></div></div>
    <svg viewBox="0 0 420 320" role="img" aria-label="Shopkeeper using a tablet at an inventory shelf"><rect x="10" y="30" width="400" height="260" rx="20" fill="#F3F3F3"/>
    <g fill="#C51F26"><rect x="40" y="60" width="60" height="40" rx="4"/><rect x="110" y="70" width="50" height="30" rx="4" fill="#F5662B"/><rect x="170" y="55" width="70" height="45" rx="4"/></g>
    <g fill="#F5662B"><rect x="40" y="140" width="55" height="40" rx="4"/><rect x="105" y="150" width="65" height="30" rx="4" fill="#C51F26"/><rect x="180" y="135" width="60" height="45" rx="4"/></g>
    <rect x="30" y="102" width="220" height="6" fill="#555"/><rect x="30" y="182" width="220" height="6" fill="#555"/>
    <circle cx="320" cy="150" r="26" fill="#E8B48C"/><path d="M296 140a24 24 0 0 1 48 0z" fill="#555"/><rect x="290" y="176" width="60" height="90" rx="14" fill="#C51F26"/>
    <rect x="262" y="200" width="56" height="38" rx="6" fill="#fff" stroke="#555" stroke-width="3" transform="rotate(-8 290 220)"/><rect x="270" y="210" width="10" height="20" fill="#F5662B" transform="rotate(-8 290 220)"/><rect x="284" y="204" width="10" height="26" fill="#2e8b57" transform="rotate(-8 290 220)"/>
    <circle cx="372" cy="70" r="22" fill="#fff"/><path d="M362 70l7 7 12-14" stroke="#2e8b57" stroke-width="5" fill="none"/></svg></section>
    <h2 id="features">What SmartStock does for your shop</h2><div class="grid g3">${feats.map(f => `<div class="card feat"><i class="fa-solid ${f[0]}"></i><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div>`;
  $('a[href="#features"]').onclick = e => { e.preventDefault(); $('#features').scrollIntoView({ behavior: 'smooth' }); };
}

// ---------- login / register ----------
function login() {
  if (token) { location.hash = '#/dashboard'; return; }
  let mode = 'login';
  const draw = () => {
    app.innerHTML = `<div class="card authbox"><div class="tabs"><button class="btn ${mode === 'login' ? '' : 'ghost'}" data-m="login">Log in</button><button class="btn ${mode === 'register' ? '' : 'ghost'}" data-m="register">Create account</button></div>
    <div id="f">${mode === 'register' ? '<label for="n">Your name</label><input id="n" autocomplete="name">' : ''}<label for="e">Email</label><input id="e" type="email" autocomplete="email">
    <label for="p">Password</label><input id="p" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
    ${mode === 'register' ? '<small>At least 8 characters with a letter and a number. We add sample products so you can try everything.</small>' : ''}
    <div class="err-text" id="er"></div><button class="btn" id="go" style="width:100%;justify-content:center">${mode === 'login' ? 'Log in' : 'Create account'}</button></div></div>`;
    app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    const submit = async () => {
      const body = { name: $('#n')?.value, email: $('#e').value.trim(), password: $('#p').value };
      if (mode === 'register' && (body.password.length < 8 || !/[A-Za-z]/.test(body.password) || !/\d/.test(body.password))) { $('#er').textContent = 'Password needs 8+ characters with a letter and a number.'; return; }
      $('#go').disabled = true;
      try { const d = await api('/auth/' + mode, 'POST', body); token = d.token; user = d.user; localStorage.setItem('ss_token', token); localStorage.setItem('ss_user', JSON.stringify(user)); toast(mode === 'login' ? 'Welcome back!' : 'Account created. Welcome to SmartStock!'); location.hash = '#/dashboard'; }
      catch (e) { $('#er').textContent = e.message; $('#go').disabled = false; }
    };
    $('#go').onclick = submit; $('#p').onkeydown = e => { if (e.key === 'Enter') submit(); };
  };
  draw();
}

// ---------- dashboard ----------
async function dashboard() {
  const d = await api('/dashboard');
  const cards = [['fa-box', 'Total products', d.totalProducts, '', '#/inventory'], ['fa-cubes', 'Total stock units', d.totalStock, 'g', '#/inventory'], ['fa-triangle-exclamation', 'Low stock', d.lowStock, 'o', '#/alerts'], ['fa-circle-xmark', 'Out of stock', d.outOfStock, '', '#/alerts'], ['fa-indian-rupee-sign', 'Inventory value', inr(d.inventoryValue), 'g', '#/reports']];
  app.innerHTML = `<div class="pagehead"><h2>Hello, ${esc(user.name.split(' ')[0])}</h2><a class="btn alt" href="#/stock"><i class="fa-solid fa-plus"></i> Record stock</a></div>
  <div class="grid g5">${cards.map(c => `<div class="card stat ${c[3]}" onclick="location.hash='${c[4]}'"><i class="fa-solid ${c[0]}"></i><div><b>${c[2]}</b>${c[1]}</div></div>`).join('')}</div>
  <div class="grid g2" style="margin-top:1rem"><div class="card"><h3>Products by category</h3><canvas id="c1"></canvas></div><div class="card"><h3>Stock availability</h3><canvas id="c2"></canvas></div>
  <div class="card"><h3>Monthly stock movement</h3><canvas id="c3"></canvas></div><div class="card"><h3>Sales value trend</h3><canvas id="c4"></canvas></div>
  <div class="card"><h3>Low-stock alerts</h3>${d.alerts.length ? d.alerts.map(alertRow).join('') + '<a href="#/alerts">See all alerts</a>' : empty('fa-circle-check', 'All products are well stocked.')}</div>
  <div class="card"><h3>Recent activity</h3>${d.recent.length ? d.recent.map(t => `<div style="padding:.35rem 0;border-bottom:1px solid #ddd"><b style="color:${t.transaction_type === 'Stock In' ? 'var(--green)' : 'var(--red)'}">${t.transaction_type === 'Stock In' ? '+' : '−'}${t.quantity}</b> ${esc(t.product_name)} <small>· ${esc(t.transaction_date.slice(0, 10))}</small></div>`).join('') : empty('fa-clock', 'No activity yet.')}</div></div>`;
  bindRestock();
  const cl = Object.keys(d.categories);
  drawChart('#c1', 'doughnut', cl, [{ data: cl.map(k => d.categories[k]), backgroundColor: COLORS }]);
  drawChart('#c2', 'bar', Object.keys(d.availability), [{ data: Object.values(d.availability), backgroundColor: ['#2e8b57', '#F5662B', '#C51F26'] }]);
  drawChart('#c3', 'bar', d.months.map(mLabel), [{ label: 'Stock in', data: d.movement.map(x => x.stock_in), backgroundColor: '#2e8b57' }, { label: 'Stock out', data: d.movement.map(x => x.stock_out), backgroundColor: '#C51F26' }]);
  drawChart('#c4', 'line', d.months.map(mLabel), [{ label: 'Sales value (₹)', data: d.sales, borderColor: '#F5662B', backgroundColor: 'rgba(245,102,43,.2)', fill: true, tension: .3 }]);
}
const alertRow = p => `<div class="alert ${p.quantity === 0 ? 'out' : ''}"><div><b>${esc(p.product_name)}</b><br><small>${p.quantity === 0 ? 'Out of stock' : 'Low: only ' + p.quantity + ' left'} (minimum ${p.minimum_stock_level})</small></div><button class="btn sm alt" data-restock="${p.product_id}" data-name="${esc(p.product_name)}"><i class="fa-solid fa-plus"></i> Restock</button></div>`;
function bindRestock() { app.querySelectorAll('[data-restock]').forEach(b => b.onclick = () => restockModal(+b.dataset.restock, b.dataset.name)); }
function restockModal(id, name) {
  modal(`<h3>Restock ${esc(name)}</h3><label for="rq">Quantity received</label><input id="rq" type="number" min="1" value="10"><div class="err-text" id="er"></div><div class="acts"><button class="btn ghost" id="cn">Cancel</button><button class="btn" id="ok">Add stock</button></div>`);
  $('#cn').onclick = closeModal;
  $('#ok').onclick = async () => { try { await api('/stock/in', 'POST', { product_id: id, quantity: $('#rq').value, description: 'Restock' }); closeModal(); toast('Stock added.'); route(); } catch (e) { $('#er').textContent = e.message; } };
}

// ---------- inventory ----------
async function inventory() {
  products = await api('/products');
  app.innerHTML = `<div class="pagehead"><h2>Inventory</h2><button class="btn" id="add"><i class="fa-solid fa-plus"></i> Add product</button></div>
  <div class="toolbar"><input id="q" placeholder="Search by name or ID" aria-label="Search"><select id="fc"><option value="">All categories</option>${[...new Set(products.map(p => p.category))].sort().map(c => `<option>${esc(c)}</option>`).join('')}</select>
  <select id="fs"><option value="">All stock status</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select>
  <select id="so"><option value="product_name">Sort: Name</option><option value="quantity">Sort: Quantity (low first)</option><option value="price">Sort: Price (high first)</option></select></div><div id="tb"></div>`;
  const draw = () => {
    const q = $('#q').value.toLowerCase(), c = $('#fc').value, s = $('#fs').value, so = $('#so').value;
    const list = products.filter(p => (!q || p.product_name.toLowerCase().includes(q) || String(p.product_id) === q.replace(/^ss-?/, '')) && (!c || p.category === c) && (!s || p.status === s))
      .sort((a, b) => so === 'quantity' ? a.quantity - b.quantity : so === 'price' ? b.price - a.price : a.product_name.localeCompare(b.product_name));
    $('#tb').innerHTML = list.length ? `<div class="tablewrap"><table><tr><th>ID</th><th>Product</th><th>Category</th><th>Price</th><th>Qty</th><th>Status</th><th>Actions</th></tr>${list.map(p => `<tr><td>SS-${p.product_id}</td><td><b>${esc(p.product_name)}</b></td><td>${esc(p.category)}</td><td>${inr(p.price)}</td><td>${p.quantity}</td><td>${badge(p.status)}</td>
      <td><button class="btn sm ghost" data-e="${p.product_id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button> <button class="btn sm danger" data-d="${p.product_id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')}</table></div>` : empty('fa-box-open', products.length ? 'No products match your search.' : 'No products yet. Click “Add product” to start.');
    $('#tb').querySelectorAll('[data-e]').forEach(b => b.onclick = () => productForm(products.find(p => p.product_id == b.dataset.e)));
    $('#tb').querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { const p = products.find(x => x.product_id == b.dataset.d); if (await confirmBox(`“${esc(p.product_name)}” and its stock history will be removed.`)) { try { await api('/products/' + p.product_id, 'DELETE'); toast('Product deleted.'); route(); } catch (e) { toast(e.message, 1); } } });
  };
  ['q', 'fc', 'fs', 'so'].forEach(i => $('#' + i).oninput = draw); $('#add').onclick = () => productForm(); draw();
}
function productForm(p) {
  const v = (k, d = '') => esc(p ? p[k] : d);
  modal(`<h3>${p ? 'Edit product' : 'Add new product'}</h3>${p ? `<small>Product ID: SS-${p.product_id}</small>` : ''}<label for="pn">Product name</label><input id="pn" value="${v('product_name')}">
  <div class="two"><div><label for="pc">Category</label><input id="pc" list="cl" value="${v('category')}"><datalist id="cl">${[...new Set(products.map(x => x.category))].map(c => `<option value="${esc(c)}">`).join('')}</datalist></div><div><label for="ps">Supplier</label><input id="ps" value="${v('supplier_name')}"></div>
  <div><label for="pp">Price (₹)</label><input id="pp" type="number" min="0" step="0.01" value="${v('price')}"></div><div><label for="pq">Quantity</label><input id="pq" type="number" min="0" value="${v('quantity', 0)}"></div></div>
  <label for="pm">Warn me when stock falls to</label><input id="pm" type="number" min="0" value="${v('minimum_stock_level', 5)}"><div class="err-text" id="er"></div>
  <div class="acts"><button class="btn ghost" id="cn">Cancel</button><button class="btn" id="ok">Save product</button></div>`);
  $('#cn').onclick = closeModal;
  $('#ok').onclick = async () => {
    const body = { product_name: $('#pn').value, category: $('#pc').value, supplier_name: $('#ps').value, price: $('#pp').value, quantity: $('#pq').value, minimum_stock_level: $('#pm').value };
    try { await api(p ? '/products/' + p.product_id : '/products', p ? 'PUT' : 'POST', body); closeModal(); toast(p ? 'Product updated.' : 'Product added.'); route(); } catch (e) { $('#er').textContent = e.message; }
  };
}

// ---------- stock ----------
async function stock() {
  const [ps, tx] = await Promise.all([api('/products'), api('/transactions?limit=50')]);
  const opts = ps.map(p => `<option value="${p.product_id}">${esc(p.product_name)} (${p.quantity} in stock)</option>`).join('');
  const form = (type, title, icon, color) => `<div class="card"><h3><i class="fa-solid ${icon}" style="color:${color}"></i> ${title}</h3><label>Product</label><select data-t="${type}" class="sp">${opts}</select>
    <label>Quantity</label><input type="number" min="1" class="sq" data-t="${type}" value="1"><label>Note (optional)</label><input class="sd" data-t="${type}" placeholder="${type === 'in' ? 'e.g. Delivery from supplier' : 'e.g. Sold to customer'}">
    <div class="err-text" data-er="${type}"></div><button class="btn ${type === 'in' ? '' : 'alt'} sg" data-t="${type}">${title}</button></div>`;
  app.innerHTML = `<h2>Stock management</h2>${ps.length ? `<div class="grid g2">${form('in', 'Add stock', 'fa-arrow-down', 'var(--green)')}${form('out', 'Record sale', 'fa-arrow-up', 'var(--red)')}</div>` : empty('fa-box-open', 'Add a product in Inventory first.')}
  <h3 style="margin-top:1.5rem">Transaction history</h3>${txTable(tx)}`;
  app.querySelectorAll('.sg').forEach(b => b.onclick = async () => {
    const t = b.dataset.t, q = s => app.querySelector(`${s}[data-t="${t}"]`);
    try { await api('/stock/' + t, 'POST', { product_id: q('.sp').value, quantity: q('.sq').value, description: q('.sd').value }); toast(t === 'in' ? 'Stock added.' : 'Sale recorded.'); route(); }
    catch (e) { app.querySelector(`[data-er="${t}"]`).textContent = e.message; toast(e.message, 1); }
  });
}
const txTable = tx => tx.length ? `<div class="tablewrap"><table><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Note</th></tr>${tx.map(t => `<tr><td>${esc(t.transaction_date.slice(0, 16))}</td><td>${esc(t.product_name)}</td><td><span class="badge ${t.transaction_type === 'Stock In' ? 'b-in' : 'b-out'}">${t.transaction_type}</span></td><td>${t.quantity}</td><td>${esc(t.description)}</td></tr>`).join('')}</table></div>` : empty('fa-clock', 'No transactions in this period.');

// ---------- alerts ----------
async function alerts() {
  const a = await api('/alerts');
  app.innerHTML = `<h2>Low stock alerts</h2>` + (a.length ? `<p>${a.filter(x => x.quantity === 0).length} out of stock, ${a.filter(x => x.quantity > 0).length} running low.</p>` + a.map(alertRow).join('') : empty('fa-circle-check', 'Good news. Nothing needs restocking right now.'));
  bindRestock();
}

// ---------- reports ----------
async function reports() {
  app.innerHTML = `<div class="pagehead"><h2>Reports</h2><button class="btn alt" id="csv"><i class="fa-solid fa-file-csv"></i> Export CSV</button></div>
  <div class="toolbar"><label style="margin:0;align-self:center">From</label><input type="date" id="rf"><label style="margin:0;align-self:center">To</label><input type="date" id="rt"><button class="btn" id="ra">Apply</button><button class="btn ghost" id="rc">Clear</button></div><div id="rb"></div>`;
  let data;
  const load = async () => {
    charts.forEach(c => c.destroy()); charts = [];
    data = await api(`/reports?from=${$('#rf').value}&to=${$('#rt').value}`);
    const mini = (title, list) => `<div class="card"><h3>${title}</h3>${list.map(p => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;border-bottom:1px solid #ddd"><span>${esc(p.product_name)}</span><b>${p.quantity}</b></div>`).join('') || empty('fa-box-open', 'No products yet.')}</div>`;
    $('#rb').innerHTML = `<div class="grid g3"><div class="card stat g"><i class="fa-solid fa-indian-rupee-sign"></i><div><b>${inr(data.inventoryValue)}</b>Total inventory value</div></div></div>
    <div class="grid g2" style="margin-top:1rem">${mini('Highest stock', data.highest)}${mini('Lowest stock', data.lowest)}<div class="card"><h3>Monthly inventory trend</h3><canvas id="r1"></canvas></div><div class="card"><h3>Value by category</h3><canvas id="r2"></canvas></div></div>
    <h3 style="margin-top:1.5rem">Category-wise report</h3>${data.categories.length ? `<div class="tablewrap"><table><tr><th>Category</th><th>Products</th><th>Units</th><th>Value</th></tr>${data.categories.map(c => `<tr><td>${esc(c.category)}</td><td>${c.products}</td><td>${c.quantity}</td><td>${inr(c.value)}</td></tr>`).join('')}</table></div>` : empty('fa-layer-group', 'No categories yet.')}
    <h3 style="margin-top:1.5rem">Stock-in and stock-out history</h3>${txTable(data.transactions.slice(0, 200))}`;
    drawChart('#r1', 'line', data.monthly.map(m => mLabel(m.m)), [{ label: 'Stock in', data: data.monthly.map(m => m.stock_in), borderColor: '#2e8b57' }, { label: 'Stock out', data: data.monthly.map(m => m.stock_out), borderColor: '#C51F26' }]);
    drawChart('#r2', 'bar', data.categories.map(c => c.category), [{ data: data.categories.map(c => c.value), backgroundColor: '#F5662B' }]);
  };
  $('#ra').onclick = load; $('#rc').onclick = () => { $('#rf').value = $('#rt').value = ''; load(); };
  $('#csv').onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, rows = [['Category report'], ['Category', 'Products', 'Units', 'Value'], ...data.categories.map(c => [c.category, c.products, c.quantity, c.value.toFixed(2)]), [], ['Transactions'], ['Date', 'Product', 'Type', 'Quantity', 'Note'], ...data.transactions.map(t => [t.transaction_date, t.product_name, t.transaction_type, t.quantity, t.description])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'smartstock-report.csv'; a.click(); toast('Report downloaded.');
  };
  await load();
}

// ---------- about ----------
function about() {
  const box = (t, items) => `<div class="card"><h3>${t}</h3><ul class="clean">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  app.innerHTML = `<h2>About SmartStock</h2><div class="card" style="border-left:6px solid var(--red)"><h3>The problem</h3><p>Small retail owners and local shopkeepers struggle to manage daily inventory and track low-stock items. They rely on manual methods, which leads to stockouts, overstocking and lost revenue.</p></div>
  <div class="grid g2" style="margin-top:1rem">${box('Impact', ['Store owners lose revenue when products are unavailable.', 'Customers are inconvenienced when essentials run out.', 'Manual tracking takes up the owner’s time.', 'Distributors face irregular demand.'])}
  ${box('Root causes', ['Dependence on outdated manual methods.', 'Lack of affordable inventory tools.', 'No real-time stock alerts.', 'Difficulty forecasting demand.'])}
  ${box('Affected stakeholders', ['Small retailers and Kirana store owners', 'Customers', 'Distributors and suppliers', 'Shop employees'])}
  ${box('Impact on stakeholders', ['Retailers: lost sales and wasted time.', 'Customers: wasted trips and fewer choices.', 'Distributors: unpredictable orders.', 'Employees: extra manual paperwork.'])}
  <div class="card"><h3>Our solution</h3><p>SmartStock is a simple, affordable, user-friendly platform. It lets small retailers monitor stock levels, track every stock movement and get timely low-stock alerts.</p></div>
  <div class="card"><h3>Team connect</h3><p>We are B.Tech students who have seen local shops run on paper registers. Edit this card with your team names and your own story before the demo.</p></div></div>`;
}

if (!location.hash) location.hash = '#/'; route();
