
const express = require('express');
const { Redis } = require('@upstash/redis');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());

// Webhook ANTES de express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.metadata?.email;
    const pkg = session.metadata?.pkg;

    const credits = pkg === 'starter' ? 500 : pkg === 'pro' ? 2500 : 7000;
    const apiKey = 'mf-' + crypto.randomBytes(16).toString('hex');

    const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    await redis.hset('api_keys', { [apiKey]: JSON.stringify({ email, credits, plan: pkg, created: Date.now() }) });

    // Enviar email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Your mifactory API Key',
      html: `<h2>Welcome to mifactory!</h2><p>Your API key: <strong>${apiKey}</strong></p><p>Credits: ${credits}</p><p>Use header: <code>x-api-key: ${apiKey}</code></p>`
    });
  }

  res.json({ received: true });
});

app.use(express.json());

const PACKAGES = {
  starter: { price: 500, credits: 500, name: 'Starter' },
  pro: { price: 2000, credits: 2500, name: 'Pro' },
  scale: { price: 5000, credits: 7000, name: 'Scale' }
};

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mifactory</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff}
header{padding:2rem;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center}
header h1{font-size:1.5rem;font-weight:700}
.hero{padding:6rem 2rem;text-align:center;max-width:800px;margin:0 auto}
.hero h2{font-size:3rem;font-weight:800;margin-bottom:1.5rem}
.hero h2 span{color:#7c3aed}
.hero p{color:#999;font-size:1.2rem;margin-bottom:3rem;line-height:1.6}
.cta{display:inline-block;background:#7c3aed;color:#fff;padding:1rem 2.5rem;border-radius:8px;text-decoration:none;font-weight:600}
.services{padding:4rem 2rem;max-width:1000px;margin:0 auto}
.services h3{text-align:center;font-size:1.8rem;margin-bottom:3rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
.card{background:#111;border:1px solid #222;border-radius:12px;padding:1.5rem}
.card h4{color:#7c3aed;margin-bottom:.5rem}
.card p{color:#888;font-size:.9rem;line-height:1.5;margin-bottom:1rem}
.card .price{font-size:.85rem;color:#555}
.pricing{padding:4rem 2rem;max-width:900px;margin:0 auto;text-align:center}
.pricing h3{font-size:1.8rem;margin-bottom:3rem}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem}
.plan{background:#111;border:1px solid #222;border-radius:12px;padding:2rem}
.plan.featured{border-color:#7c3aed}
.plan .amount{font-size:2.5rem;font-weight:800;margin:1rem 0}
.plan .credits{color:#888;margin-bottom:1.5rem}
.plan button{display:block;width:100%;background:#7c3aed;color:#fff;padding:.75rem;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-size:1rem}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:100;align-items:center;justify-content:center}
.modal.active{display:flex}
.modal-box{background:#111;border:1px solid #333;border-radius:12px;padding:2rem;width:90%;max-width:400px}
.modal-box h4{margin-bottom:1rem;font-size:1.2rem}
.modal-box input{width:100%;padding:.75rem;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:1rem;margin-bottom:1rem}
.modal-box button{width:100%;background:#7c3aed;color:#fff;padding:.75rem;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-size:1rem}
footer{padding:2rem;text-align:center;color:#555;border-top:1px solid #111;font-size:.9rem}
</style>
</head>
<body>
<header><h1>mifactory</h1><span>AI Infrastructure · Pay-per-use</span></header>
<section class="hero">
  <h2>Infrastructure for <span>Autonomous Agents</span></h2>
  <p>Memory, verification, scraping, specs, contracts, and multi-agent orchestration. No subscriptions. Pay only for what you use.</p>
  <a href="#pricing" class="cta">Get API Key</a>
</section>
<section class="services">
  <h3>7 MCP Services. One API Key.</h3>
  <div class="grid">
    <div class="card"><h4>Logic Verifier</h4><p>Verify reasoning chains before agents act. Detect logical fallacies and invalid entailments.</p><div class="price">2 credits/verify</div></div>
    <div class="card"><h4>Agent Memory</h4><p>Persistent memory across sessions. Context that survives between agent runs.</p><div class="price">1 credit/write</div></div>
    <div class="card"><h4>Scraping API</h4><p>Extract clean text from any URL for competitive intelligence workflows.</p><div class="price">1 credit/scrape</div></div>
    <div class="card"><h4>Spec API</h4><p>Convert documents to agent-readable specifications with objectives and constraints.</p><div class="price">10 credits/convert</div></div>
    <div class="card"><h4>Contracts</h4><p>Generate freelance contracts for any country. AI-powered.</p><div class="price">50 credits/contract</div></div>
    <div class="card" style="border-color:#7c3aed"><h4>🚀 MAS-Factory</h4><p>Describe a task in plain language. mifactory generates a multi-agent blueprint and executes it automatically.</p><div class="price">10 credits/workflow</div></div>
  </div>
</section>
<section class="pricing" id="pricing">
  <h3>Simple Credit Pricing</h3>
  <div style="background:#111;border:1px solid #7c3aed;border-radius:12px;padding:2rem;max-width:400px;margin:0 auto 2rem auto;text-align:center">
    <h4 style="color:#7c3aed;font-size:1.2rem;margin-bottom:.5rem">🎁 Try Free</h4>
    <p style="color:#888;margin-bottom:1rem">50 credits, no credit card required</p>
    <input type="email" id="free-email" placeholder="your@email.com" style="width:100%;padding:.75rem;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;font-size:1rem;margin-bottom:.75rem">
    <button onclick="claimFree()" style="width:100%;background:#7c3aed;color:#fff;padding:.75rem;border-radius:8px;border:none;font-weight:600;cursor:pointer;font-size:1rem">Get Free Credits</button>
    <p id="free-msg" style="margin-top:.75rem;color:#888;font-size:.85rem"></p>
  </div>
  <div class="plans">
    <div class="plan"><h4>Starter</h4><div class="amount">$5</div><div class="credits">500 credits</div><button onclick="openModal('starter')">Get Started</button></div>
    <div class="plan featured"><h4>Pro</h4><div class="amount">$20</div><div class="credits">2,500 credits · Best value</div><button onclick="openModal('pro')">Get Pro</button></div>
    <div class="plan"><h4>Scale</h4><div class="amount">$50</div><div class="credits">7,000 credits</div><button onclick="openModal('scale')">Get Scale</button></div>
  </div>
</section>
<div class="modal" id="modal">
  <div class="modal-box">
    <h4>Enter your email to continue</h4>
    <input type="email" id="email-input" placeholder="your@email.com">
    <button onclick="checkout()">Proceed to Payment</button>
  </div>
</div>
<script>
let currentPkg = '';
function openModal(pkg) { currentPkg = pkg; document.getElementById('modal').classList.add('active'); document.getElementById('email-input').focus(); }
async function checkout() {
  const email = document.getElementById('email-input').value;
  if (!email) { alert('Please enter your email'); return; }
  const res = await fetch('/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pkg: currentPkg, email }) });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}
</script>
<footer>mifactory · 7 MCP services · Support: sujetron@gmail.com</footer>
</body>
</html>`);
});

app.post('/free', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const alreadyIP = await redis.hget('free_ips', ip);
    if (alreadyIP) return res.status(409).json({ error: 'Free credits already claimed from this device' });
    const already = await redis.hget('free_emails', email);
    if (already) return res.status(409).json({ error: 'Free credits already claimed for this email' });
    const apiKey = 'mf-free-' + crypto.randomBytes(8).toString('hex');
    await redis.hset('api_keys', { [apiKey]: JSON.stringify({ email, credits: 50, plan: 'free', created: Date.now() }) });
    await redis.hset('free_emails', { [email]: '1' });
    await redis.hset('free_ips', { [ip]: '1' });
    const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await transporter.sendMail({ from: process.env.SMTP_USER, to: email, subject: 'Your mifactory free API key', html: '<h2>Welcome to mifactory!</h2><p>Your free API key: <strong>' + apiKey + '</strong></p><p>Credits: 50</p><p><strong>Try it now:</strong> <a href="https://mifactory-orchestrator.vercel.app/ui">Open the MAS-Factory UI</a></p><p>Enter your API key and describe any task to run a multi-agent workflow.</p><p>Use header for direct API calls: <code>x-api-key: ' + apiKey + '</code></p><p>When ready to scale: <a href="https://mifactory-portal.vercel.app">upgrade here</a></p>' });
    res.json({ success: true, message: 'API key sent to ' + email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/checkout', async (req, res) => {
  const { pkg, email } = req.body;
  if (!pkg || !email) return res.status(400).json({ error: 'Missing pkg or email' });
  const p = PACKAGES[pkg];
  if (!p) return res.status(400).json({ error: 'Invalid package' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'mifactory ' + p.name + ' — ' + p.credits + ' credits' }, unit_amount: p.price }, quantity: 1 }],
      mode: 'payment',
      success_url: process.env.PRODUCT_URL + '?success=1',
      cancel_url: process.env.PRODUCT_URL + '?canceled=1',
      metadata: { pkg, email }
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/credits', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key' });
  const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  const keyData = await redis.hget('api_keys', apiKey);
  if (!keyData) return res.status(403).json({ error: 'Invalid API key' });
  const parsed = typeof keyData === 'string' ? JSON.parse(keyData) : keyData;
  res.json({ credits: parsed.credits, plan: parsed.plan, email: parsed.email });
});

module.exports = app;
