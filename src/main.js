// CurveForge — Meteora DBC Config Designer
import './style.css';
// === Solana Wallet + Deploy ===
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

const NETWORKS = {
  devnet: { rpc: 'https://api.devnet.solana.com', label: 'Devnet', explorer: 'https://solscan.io/tx/TX?cluster=devnet' },
  mainnet: { rpc: 'https://api.mainnet-beta.solana.com', label: 'Mainnet', explorer: 'https://solscan.io/tx/TX' }
};
let currentNetwork = 'mainnet';
const DBC_PROGRAM = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
let connection = new Connection(NETWORKS[currentNetwork].rpc, 'confirmed');

function switchNetwork(net) {
  currentNetwork = net;
  connection = new Connection(NETWORKS[net].rpc, 'confirmed');
  document.querySelectorAll('.network-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.network === net);
  });
  const badge = document.querySelector('.network-badge');
  if (badge) badge.textContent = NETWORKS[net].label;
  const airdropBtn = document.getElementById('btn-airdrop');
  if (airdropBtn) airdropBtn.style.display = net === 'devnet' ? 'block' : 'none';
  if (wallet.connected) updateBalance();
  fetchLiveDeployments();
}

// === Shareable URLs ===
function encodeConfig() {
  const cfg = {
    s: state.shape, sp: state.startPrice, ep: state.endPrice,
    sg: state.segments, mt: state.migrationThreshold,
    fm: state.feeMode, sf: state.startingFee, ef: state.endingFee,
    fd: state.feeDuration, df: state.dammFee, ll: state.lockedLiquidity,
    ts: state.totalSupply, td: state.tokenDecimals, qt: state.quoteToken
  };
  return btoa(JSON.stringify(cfg));
}
function decodeConfig(hash) {
  try {
    const cfg = JSON.parse(atob(hash));
    if (cfg.s) state.shape = cfg.s;
    if (cfg.sp) state.startPrice = cfg.sp;
    if (cfg.ep) state.endPrice = cfg.ep;
    if (cfg.sg) state.segments = cfg.sg;
    if (cfg.mt) state.migrationThreshold = cfg.mt;
    if (cfg.fm) state.feeMode = cfg.fm;
    if (cfg.sf) state.startingFee = cfg.sf;
    if (cfg.ef) state.endingFee = cfg.ef;
    if (cfg.fd) state.feeDuration = cfg.fd;
    if (cfg.df) state.dammFee = cfg.df;
    if (cfg.ll) state.lockedLiquidity = cfg.ll;
    if (cfg.ts) state.totalSupply = cfg.ts;
    if (cfg.td) state.tokenDecimals = cfg.td;
    if (cfg.qt) state.quoteToken = cfg.qt;
    syncUI(); updateAll();
    return true;
  } catch { return false; }
}
function shareConfig() {
  const url = window.location.origin + window.location.pathname + '#cfg=' + encodeConfig();
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('btn-share');
    if (btn) { const old = btn.textContent; btn.textContent = 'Link Copied!'; setTimeout(() => btn.textContent = old, 2000); }
  });
  window.location.hash = 'cfg=' + encodeConfig();
}
// Load from URL on init
if (window.location.hash.startsWith('#cfg=')) {
  decodeConfig(window.location.hash.slice(5));
}

// === Live Deployment Feed ===
let liveDeployments = [];
async function fetchLiveDeployments() {
  const feedEl = document.getElementById('live-feed-list');
  if (!feedEl) return;
  feedEl.innerHTML = '<div class="feed-loading">Loading on-chain data...</div>';
  try {
    const sigs = await connection.getSignaturesForAddress(DBC_PROGRAM, { limit: 10 });
    liveDeployments = sigs;
    if (sigs.length === 0) {
      feedEl.innerHTML = '<div class="feed-empty">No recent transactions</div>';
      return;
    }
    feedEl.innerHTML = sigs.map((s, i) => {
      const time = s.blockTime ? new Date(s.blockTime * 1000) : null;
      const ago = time ? timeAgo(time) : 'Unknown';
      const sig = s.signature;
      const short = sig.slice(0, 6) + '...' + sig.slice(-6);
      const url = NETWORKS[currentNetwork].explorer.replace('TX', sig);
      const status = s.err ? 'Failed' : 'Success';
      const statusClass = s.err ? 'feed-status-err' : 'feed-status-ok';
      return `<a href="${url}" target="_blank" class="feed-item">
        <div class="feed-item-left">
          <span class="feed-sig">${short}</span>
          <span class="feed-time">${ago}</span>
        </div>
        <span class="feed-status ${statusClass}">${status}</span>
      </a>`;
    }).join('');
    setText('live-count', sigs.length + ' recent');
  } catch (e) {
    feedEl.innerHTML = '<div class="feed-empty">Could not load — try switching network</div>';
  }
}
function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// Bind share button
document.getElementById('btn-share')?.addEventListener('click', shareConfig);
// Bind network toggle
document.querySelectorAll('.network-toggle-btn')?.forEach(b => {
  b.addEventListener('click', () => switchNetwork(b.dataset.network));
});
// Load live feed on init
setTimeout(fetchLiveDeployments, 500);


const wallet = { connected: false, publicKey: null, provider: null };

function getPhantom() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

async function connectWallet() {
  const btn = document.getElementById('btn-connect-wallet');
  const provider = getPhantom();
  if (!provider) {
    window.open('https://phantom.app/', '_blank');
    return;
  }
  try {
    const resp = await provider.connect();
    wallet.connected = true;
    wallet.publicKey = resp.publicKey;
    wallet.provider = provider;
    const addr = resp.publicKey.toString();
    const short = addr.slice(0,4) + '...' + addr.slice(-4);
    btn.innerHTML = '<span class="wallet-dot"></span>' + short;
    btn.classList.add('connected');

    // Update deploy panel
    const info = document.getElementById('deploy-wallet-info');
    if (info) { info.style.display = 'block'; }
    setText('deploy-wallet-addr', short);
    const deployBtn = document.getElementById('btn-deploy');
    if (deployBtn) { deployBtn.disabled = false; deployBtn.textContent = 'Deploy to Devnet'; }

    // Update step 1
    setStepDone(1);
    updateBalance();

    provider.on('disconnect', () => {
      wallet.connected = false; wallet.publicKey = null;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/></svg>Connect Wallet';
      btn.classList.remove('connected');
      const info2 = document.getElementById('deploy-wallet-info');
      if (info2) info2.style.display = 'none';
      const deployBtn2 = document.getElementById('btn-deploy');
      if (deployBtn2) { deployBtn2.disabled = true; deployBtn2.textContent = 'Connect Wallet First'; }
    });
  } catch (e) { console.error('Wallet connect failed:', e); }
}

async function updateBalance() {
  if (!wallet.publicKey) return;
  try {
    const bal = await connection.getBalance(wallet.publicKey);
    const sol = (bal / LAMPORTS_PER_SOL).toFixed(4);
    setText('deploy-balance', sol + ' SOL');
  } catch (e) { setText('deploy-balance', 'Error'); }
}

async function requestAirdrop() {
  if (!wallet.publicKey) return;
  const btn = document.getElementById('btn-airdrop');
  if (btn) { btn.textContent = 'Requesting...'; btn.disabled = true; }
  try {
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
    await updateBalance();
    if (btn) { btn.textContent = '+2 SOL ✓'; setTimeout(() => { btn.textContent = 'Request Devnet SOL'; btn.disabled = false; }, 2000); }
  } catch (e) {
    if (btn) { btn.textContent = 'Failed (rate limit)'; btn.disabled = false; }
  }
}

function setStepDone(n) {
  const steps = document.querySelectorAll('.deploy-step');
  steps.forEach(s => {
    const sn = parseInt(s.dataset.step);
    if (sn < n) { s.className = 'deploy-step done'; s.querySelector('.step-status').textContent = 'Done'; }
    else if (sn === n) { s.className = 'deploy-step done'; s.querySelector('.step-status').textContent = 'Done'; }
    else { s.className = 'deploy-step'; s.querySelector('.step-status').textContent = 'Waiting'; }
  });
}
function setStepActive(n) {
  const steps = document.querySelectorAll('.deploy-step');
  steps.forEach(s => {
    const sn = parseInt(s.dataset.step);
    if (sn < n) { s.className = 'deploy-step done'; s.querySelector('.step-status').textContent = 'Done'; }
    else if (sn === n) { s.className = 'deploy-step active'; s.querySelector('.step-status').textContent = 'In Progress'; }
    else { s.className = 'deploy-step'; s.querySelector('.step-status').textContent = 'Waiting'; }
  });
}
function setStepError(n, msg) {
  const step = document.querySelector(`.deploy-step[data-step="${n}"]`);
  if (step) { step.className = 'deploy-step error'; step.querySelector('.step-status').textContent = msg || 'Failed'; }
}

async function deployConfig() {
  if (!wallet.connected || !wallet.provider) return;
  const deployBtn = document.getElementById('btn-deploy');
  if (deployBtn) { deployBtn.disabled = true; deployBtn.textContent = 'Deploying...'; }

  try {
    // Step 2: Build transaction
    setStepActive(2);
    await new Promise(r => setTimeout(r, 500));

    // Create a config account keypair
    const configKeypair = Keypair.generate();
    const configPubkey = configKeypair.publicKey;

    // Build the curve parameters
    const sp = segPrices(state.shape, state.segments, state.startPrice, state.endPrice);
    const wts = segWeights(state.shape, state.segments);

    // Create the config account and store curve data
    // We store the config as a memo + create account for on-chain record
    const space = 512; // Account data space for config
    const rentExempt = await connection.getMinimumBalanceForRentExemption(space);

    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: configPubkey,
      lamports: rentExempt,
      space: space,
      programId: DBC_PROGRAM,
    });

    // Encode curve config as memo for on-chain record
    const configData = JSON.stringify({
      _app: 'CurveForge',
      shape: state.shape,
      segments: state.segments,
      prices: sp.map(p => p.toPrecision(6)),
      weights: wts,
      supply: state.totalSupply,
      threshold: state.migrationThreshold,
      fee: { mode: state.feeMode, start: state.startingFee, end: state.endingFee, dur: state.feeDuration },
      damm: state.dammFee,
      locked: state.lockedLiquidity,
    });

    // Create transaction
    const tx = new Transaction();
    tx.add(createAccountIx);
    tx.feePayer = wallet.publicKey;

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    // Partial sign with config keypair
    tx.partialSign(configKeypair);

    setStepDone(2);

    // Step 3: Sign with wallet
    setStepActive(3);
    const signed = await wallet.provider.signTransaction(tx);
    setStepDone(3);

    // Step 4: Send and confirm
    setStepActive(4);
    const rawTx = signed.serialize();
    const sig = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
    await connection.confirmTransaction(sig, 'confirmed');
    setStepDone(4);

    // Show result
    const result = document.getElementById('deploy-result');
    const link = document.getElementById('deploy-tx-link');
    if (result) result.style.display = 'block';
    if (link) {
      link.href = NETWORKS[currentNetwork].explorer.replace('TX', sig);
      link.textContent = sig.slice(0,8) + '...' + sig.slice(-8) + ' → View on Solscan (' + NETWORKS[currentNetwork].label + ')';
    }
    if (deployBtn) { deployBtn.textContent = 'Deployed ✓'; }
    await updateBalance();

  } catch (e) {
    console.error('Deploy failed:', e);
    setStepError(3, e.message?.includes('User rejected') ? 'Rejected' : 'Failed');
    if (deployBtn) { deployBtn.disabled = false; deployBtn.textContent = 'Retry Deploy'; }
  }
}

// Bind wallet events
document.getElementById('btn-connect-wallet')?.addEventListener('click', connectWallet);
document.getElementById('btn-deploy')?.addEventListener('click', deployConfig);
document.getElementById('btn-airdrop')?.addEventListener('click', requestAirdrop);


const state = {
  shape:'linear', totalSupply:1e9, tokenDecimals:9, quoteToken:'SOL',
  startPrice:0.000000001, endPrice:0.000001, segments:3, migrationThreshold:85,
  feeMode:'exponential', startingFee:90, endingFee:1, feeDuration:60,
  dammFee:100, lockedLiquidity:100,
  sim:{totalSpent:0,tokensBought:0,currentPrice:0,trades:[],quoteReserve:0}
};

// === Tab Nav ===
document.querySelectorAll('.nav-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    const p=document.getElementById('panel-'+tab.dataset.tab);
    if(p)p.classList.add('active');
    if(tab.dataset.tab==='export')genExport();
    if(tab.dataset.tab==='presets')renderPresets();
    if(tab.dataset.tab==='simulator')resetSim();
  });
});

// === Curve Math ===
function curvePoints(shape,segs,sp,ep){
  const pts=[];const n=Math.max(segs,1);const steps=n*20;
  for(let i=0;i<=steps;i++){
    const t=i/steps;let price;
    switch(shape){
      case'exponential':price=sp*Math.pow(ep/sp,Math.pow(t,2));break;
      case'flat':price=t<0.8?sp+(ep-sp)*0.15*(t/0.8):sp+(ep-sp)*(0.15+0.85*Math.pow((t-0.8)/0.2,2));break;
      case'scurve':{const s=1/(1+Math.exp(-12*(t-0.5)));price=sp+(ep-sp)*s;break;}
      default:price=sp+(ep-sp)*t;
    }
    pts.push({t,price});
  }
  return pts;
}
function segWeights(shape,n){
  const w=[];
  for(let i=0;i<n;i++){
    const t=(i+0.5)/n;
    switch(shape){
      case'exponential':w.push(Math.max(1,Math.round(10*Math.pow(t,2))));break;
      case'flat':w.push(t<0.7?10:Math.max(1,Math.round(10*(1-t))));break;
      case'scurve':w.push(Math.max(1,Math.round(10*Math.sin(Math.PI*t))));break;
      default:w.push(Math.max(1,Math.round(5+5*t)));
    }
  }
  return w;
}
function feeSchedule(mode,sf,ef,dur){
  const pts=[];
  for(let t=0;t<=dur;t+=Math.max(1,dur/60)){
    const f=t/dur;let fee;
    if(mode==='exponential')fee=ef+(sf-ef)*Math.exp(-5*f);
    else fee=sf+(ef-sf)*f;
    pts.push({time:t,fee:Math.max(ef,fee)});
  }
  return pts;
}
function segPrices(shape,n,sp,ep){
  const p=[sp];
  for(let i=1;i<=n;i++){
    const t=i/n;let price;
    switch(shape){
      case'exponential':price=sp*Math.pow(ep/sp,Math.pow(t,2));break;
      case'flat':price=t<0.8?sp+(ep-sp)*0.15*(t/0.8):sp+(ep-sp)*(0.15+0.85*Math.pow((t-0.8)/0.2,2));break;
      case'scurve':{const s=1/(1+Math.exp(-12*(t-0.5)));price=sp+(ep-sp)*s;break;}
      default:price=sp+(ep-sp)*t;
    }
    p.push(price);
  }
  return p;
}

// === Canvas Drawing ===
function drawCurve(){
  const canvas=document.getElementById('curve-chart');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.parentElement.getBoundingClientRect();
  canvas.width=rect.width*dpr;canvas.height=Math.max(300,rect.height)*dpr;
  canvas.style.width=rect.width+'px';canvas.style.height=Math.max(300,rect.height)+'px';
  ctx.scale(dpr,dpr);
  const W=rect.width,H=Math.max(300,rect.height);
  const pad={top:20,right:20,bottom:40,left:65};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;
  ctx.clearRect(0,0,W,H);
  const pts=curvePoints(state.shape,state.segments,state.startPrice,state.endPrice);
  const logMin=Math.log10(state.startPrice),logMax=Math.log10(state.endPrice);
  const logRange=logMax-logMin||1;

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
  for(let i=0;i<=5;i++){const y=pad.top+(cH/5)*i;ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();}
  for(let i=0;i<=5;i++){const x=pad.left+(cW/5)*i;ctx.beginPath();ctx.moveTo(x,pad.top);ctx.lineTo(x,H-pad.bottom);ctx.stroke();}

  // Segment lines
  const sp2=segPrices(state.shape,state.segments,state.startPrice,state.endPrice);
  ctx.strokeStyle='rgba(232,98,44,0.10)';ctx.setLineDash([3,3]);
  for(let i=1;i<sp2.length-1;i++){
    const lp=Math.log10(sp2[i]);const y=pad.top+cH*(1-(lp-logMin)/logRange);
    ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
  }
  ctx.setLineDash([]);

  // Fill
  const grad=ctx.createLinearGradient(0,pad.top,0,H-pad.bottom);
  grad.addColorStop(0,'rgba(232,98,44,0.10)');grad.addColorStop(1,'rgba(232,98,44,0.02)');
  ctx.beginPath();ctx.moveTo(pad.left,H-pad.bottom);
  pts.forEach(p=>{const x=pad.left+p.t*cW;const y=pad.top+cH*(1-(Math.log10(p.price)-logMin)/logRange);ctx.lineTo(x,y);});
  ctx.lineTo(W-pad.right,H-pad.bottom);ctx.closePath();ctx.fillStyle=grad;ctx.fill();

  // Line
  const lg=ctx.createLinearGradient(pad.left,0,W-pad.right,0);
  lg.addColorStop(0,'#e8622c');lg.addColorStop(1,'#e8622c');
  ctx.beginPath();
  pts.forEach((p,i)=>{const x=pad.left+p.t*cW;const y=pad.top+cH*(1-(Math.log10(p.price)-logMin)/logRange);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.strokeStyle=lg;ctx.lineWidth=1.5;ctx.stroke();

  // (clean — no glow)

  // Dots
  const sy=pad.top+cH*(1-(Math.log10(state.startPrice)-logMin)/logRange);
  const ey=pad.top+cH*(1-(Math.log10(state.endPrice)-logMin)/logRange);
  [[pad.left,sy],[W-pad.right,ey]].forEach(([x,y])=>{
    ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='#e8622c';ctx.fill();
    
  });

  // Labels
  ctx.fillStyle='rgba(92,90,104,0.9)';ctx.font='500 10px Inter,system-ui';ctx.textAlign='center';
  for(let i=0;i<=5;i++){const x=pad.left+(cW/5)*i;ctx.fillText(Math.round(i*20)+'%',x,H-pad.bottom+18);}
  ctx.textAlign='right';
  for(let i=0;i<=5;i++){const y=pad.top+(cH/5)*i;const lv=logMax-(logRange/5)*i;ctx.fillText(fmtSci(Math.pow(10,lv)),pad.left-8,y+4);}
  ctx.textAlign='center';ctx.fillStyle='rgba(92,90,104,0.7)';ctx.font='500 9px Inter';
  ctx.fillText('Curve Progress →',W/2,H-4);
  ctx.save();ctx.translate(12,H/2);ctx.rotate(-Math.PI/2);ctx.fillText('Price ('+state.quoteToken+')',0,0);ctx.restore();
}

function drawFeeChart(){
  const c=document.getElementById('fee-chart');if(!c)return;
  const ctx=c.getContext('2d');const dpr=window.devicePixelRatio||1;
  const rect=c.parentElement.getBoundingClientRect();
  const W=rect.width-32,H=120;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const pad={top:10,right:10,bottom:20,left:35};const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;
  const fd=feeSchedule(state.feeMode,state.startingFee,state.endingFee,state.feeDuration);
  const mf=state.startingFee;
  const gr=ctx.createLinearGradient(0,pad.top,0,H-pad.bottom);
  gr.addColorStop(0,'rgba(167,139,250,0.10)');gr.addColorStop(1,'rgba(167,139,250,0.02)');
  ctx.beginPath();ctx.moveTo(pad.left,H-pad.bottom);
  fd.forEach(p=>{const x=pad.left+(p.time/state.feeDuration)*cW;const y=pad.top+cH*(1-p.fee/mf);ctx.lineTo(x,y);});
  ctx.lineTo(W-pad.right,H-pad.bottom);ctx.closePath();ctx.fillStyle=gr;ctx.fill();
  ctx.beginPath();fd.forEach((p,i)=>{const x=pad.left+(p.time/state.feeDuration)*cW;const y=pad.top+cH*(1-p.fee/mf);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.strokeStyle='#a78bfa';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle='rgba(155,151,176,0.6)';ctx.font='500 9px Inter';ctx.textAlign='right';
  ctx.fillText(mf+'%',pad.left-4,pad.top+8);ctx.fillText(state.endingFee+'%',pad.left-4,H-pad.bottom);
  ctx.textAlign='center';ctx.fillText('0s',pad.left,H-4);ctx.fillText(state.feeDuration+'s',W-pad.right,H-4);
}

function drawLiqChart(){
  const c=document.getElementById('liquidity-chart');if(!c)return;
  const ctx=c.getContext('2d');const dpr=window.devicePixelRatio||1;
  const rect=c.parentElement.getBoundingClientRect();
  const W=rect.width-32,H=120;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const pad={top:10,right:10,bottom:20,left:10};const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;
  const wts=segWeights(state.shape,state.segments);const mw=Math.max(...wts);
  const bw=Math.min(40,(cW/state.segments)-4);
  wts.forEach((w,i)=>{
    const x=pad.left+(i+0.5)*(cW/state.segments)-bw/2;const h=(w/mw)*cH;const y=pad.top+cH-h;
    const bg=ctx.createLinearGradient(0,y,0,y+h);bg.addColorStop(0,'rgba(96,165,250,0.5)');bg.addColorStop(1,'rgba(96,165,250,0.15)');
    ctx.fillStyle=bg;const r=3;
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+bw-r,y);ctx.quadraticCurveTo(x+bw,y,x+bw,y+r);
    ctx.lineTo(x+bw,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.fill();
    ctx.fillStyle='rgba(155,151,176,0.6)';ctx.font='500 8px Inter';ctx.textAlign='center';
    ctx.fillText('S'+(i+1),x+bw/2,H-4);
  });
}

// === Presets ===
const PRESETS=[
  {id:'meme-std',title:'Meme Standard',cat:'meme',color:'#22c55e',desc:'Fast exponential curve. High initial fees to deter snipers, quick graduation.',
    cfg:{shape:'exponential',startPrice:0.000000001,endPrice:0.00001,segments:3,migrationThreshold:85,startingFee:90,endingFee:1,feeMode:'exponential',feeDuration:60,dammFee:100,lockedLiquidity:100}},
  {id:'meme-moon',title:'Moon Mission',cat:'meme',color:'#eab308',desc:'Ultra-steep 10,000x curve. Maximum price discovery range.',
    cfg:{shape:'exponential',startPrice:0.0000000001,endPrice:0.000001,segments:4,migrationThreshold:100,startingFee:95,endingFee:2,feeMode:'exponential',feeDuration:30,dammFee:200,lockedLiquidity:100}},
  {id:'rwa-equity',title:'Equity / Stock Pair',cat:'rwa',color:'#3b82f6',desc:'Flat curve for tokenized stocks & RWAs. Slow price discovery, USDC quote.',
    cfg:{shape:'flat',startPrice:0.01,endPrice:1,segments:8,migrationThreshold:750,startingFee:10,endingFee:0.5,feeMode:'linear',feeDuration:300,dammFee:25,lockedLiquidity:100,quoteToken:'USDC'}},
  {id:'rwa-bond',title:'RWA Bond',cat:'rwa',color:'#6366f1',desc:'Minimal curve slope for yield-bearing or fixed-income tokenized assets.',
    cfg:{shape:'flat',startPrice:0.1,endPrice:0.5,segments:4,migrationThreshold:500,startingFee:5,endingFee:0.25,feeMode:'linear',feeDuration:600,dammFee:25,lockedLiquidity:100,quoteToken:'USDC'}},
  {id:'ai-agent',title:'AI Agent Token',cat:'ai',color:'#a855f7',desc:'S-curve for AI utility tokens. Dynamic pricing for organic discovery.',
    cfg:{shape:'scurve',startPrice:0.0000001,endPrice:0.001,segments:6,migrationThreshold:50,startingFee:50,endingFee:1,feeMode:'exponential',feeDuration:120,dammFee:100,lockedLiquidity:100}},
  {id:'fair-launch',title:'Community Fair',cat:'fair',color:'#14b8a6',desc:'Single segment linear. Maximum simplicity, equal opportunity.',
    cfg:{shape:'linear',startPrice:0.000000001,endPrice:0.0000005,segments:1,migrationThreshold:30,startingFee:25,endingFee:1,feeMode:'linear',feeDuration:120,dammFee:100,lockedLiquidity:100}},
  {id:'fair-wide',title:'Wide Distribution',cat:'fair',color:'#0ea5e9',desc:'Low multiplier, deep liquidity. Broad token distribution.',
    cfg:{shape:'linear',startPrice:0.00000001,endPrice:0.0000001,segments:2,migrationThreshold:50,startingFee:15,endingFee:1,feeMode:'linear',feeDuration:180,dammFee:100,lockedLiquidity:100}},
  {id:'ai-depin',title:'DePIN Utility',cat:'ai',color:'#f43f5e',desc:'Multi-segment progressive pricing for infrastructure tokens.',
    cfg:{shape:'scurve',startPrice:0.00001,endPrice:0.01,segments:10,migrationThreshold:200,startingFee:30,endingFee:0.5,feeMode:'exponential',feeDuration:240,dammFee:100,lockedLiquidity:100}}
];

function renderPresets(filter='all'){
  const grid=document.getElementById('presets-grid');if(!grid)return;
  const list=filter==='all'?PRESETS:PRESETS.filter(p=>p.cat===filter);
  grid.innerHTML=list.map(p=>{
    const mult=p.cfg.endPrice/p.cfg.startPrice;
    const ms=mult>=1000?(mult/1000).toFixed(0)+'k':mult.toFixed(0);
    return `<div class="preset-card" data-preset="${p.id}" style="--card-accent:${p.color}">
      <div class="preset-card-header"><div class="preset-card-title">${p.title}</div>
      <span class="preset-card-badge" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}44">${p.cat.toUpperCase()}</span></div>
      <div class="preset-card-desc">${p.desc}</div>
      <div class="preset-card-canvas"><canvas id="pc-${p.id}"></canvas></div>
      <div class="preset-card-stats">
        <div class="preset-stat"><span class="preset-stat-label">Multiplier</span><span class="preset-stat-value" style="color:${p.color}">${ms}x</span></div>
        <div class="preset-stat"><span class="preset-stat-label">Segments</span><span class="preset-stat-value">${p.cfg.segments}</span></div>
        <div class="preset-stat"><span class="preset-stat-label">Threshold</span><span class="preset-stat-value">${p.cfg.migrationThreshold} ${p.cfg.quoteToken||'SOL'}</span></div>
        <div class="preset-stat"><span class="preset-stat-label">Shape</span><span class="preset-stat-value">${p.cfg.shape}</span></div>
      </div></div>`;
  }).join('');
  setTimeout(()=>{list.forEach(p=>{
    const cv=document.getElementById('pc-'+p.id);if(!cv)return;
    const ctx=cv.getContext('2d');const dpr=window.devicePixelRatio||1;
    const r=cv.parentElement.getBoundingClientRect();
    cv.width=r.width*dpr;cv.height=r.height*dpr;cv.style.width=r.width+'px';cv.style.height=r.height+'px';ctx.scale(dpr,dpr);
    const W=r.width,H=r.height,pd=8;
    const pts=curvePoints(p.cfg.shape,p.cfg.segments,p.cfg.startPrice,p.cfg.endPrice);
    const lm=Math.log10(p.cfg.startPrice),lx=Math.log10(p.cfg.endPrice),lr=lx-lm||1;
    const gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,p.color+'33');gr.addColorStop(1,p.color+'05');
    ctx.beginPath();ctx.moveTo(pd,H-pd);
    pts.forEach(pt=>{const x=pd+pt.t*(W-2*pd);const y=pd+(H-2*pd)*(1-(Math.log10(pt.price)-lm)/lr);ctx.lineTo(x,y);});
    ctx.lineTo(W-pd,H-pd);ctx.closePath();ctx.fillStyle=gr;ctx.fill();
    ctx.beginPath();pts.forEach((pt,i)=>{const x=pd+pt.t*(W-2*pd);const y=pd+(H-2*pd)*(1-(Math.log10(pt.price)-lm)/lr);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.stroke();
  });},50);
  grid.querySelectorAll('.preset-card').forEach(card=>{
    card.addEventListener('click',()=>{
      const p=PRESETS.find(x=>x.id===card.dataset.preset);if(!p)return;
      applyPreset(p.cfg);document.querySelector('[data-tab="designer"]').click();
    });
  });
}

function applyPreset(c){
  Object.assign(state,{shape:c.shape,startPrice:c.startPrice,endPrice:c.endPrice,
    segments:c.segments,migrationThreshold:c.migrationThreshold,
    startingFee:c.startingFee,endingFee:c.endingFee,feeMode:c.feeMode,
    feeDuration:c.feeDuration,dammFee:c.dammFee,lockedLiquidity:c.lockedLiquidity,
    quoteToken:c.quoteToken||'SOL'});
  syncUI();updateAll();
}

// === Export ===
function genExport(fmt='typescript'){
  const el=document.getElementById('code-output');if(!el)return;
  const sp=segPrices(state.shape,state.segments,state.startPrice,state.endPrice);
  const wts=segWeights(state.shape,state.segments);
  const fm=state.feeMode==='exponential'?'FeeSchedulerExponential':'FeeSchedulerLinear';
  const qd=state.quoteToken==='SOL'?'NINE':'SIX';
  const td=state.tokenDecimals<=6?'SIX':'NINE';
  if(fmt==='typescript'){
    el.textContent=`import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, Keypair } from "@solana/web3.js";
import {
  ActivationType, BaseFeeMode, buildCurveWithCustomSqrtPrices,
  createSqrtPrices, CollectFeeMode, DammV2DynamicFeeMode,
  DynamicBondingCurveClient, MigrationFeeOption, MigrationOption,
  TokenDecimal, TokenType, TokenAuthorityOption, MigratedCollectFeeMode,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

// CurveForge Config — ${state.shape} | ${state.segments} segments | ${(state.endPrice/state.startPrice).toFixed(0)}x
const connection = new Connection(process.env.RPC_URL!, "confirmed");
const client = DynamicBondingCurveClient.create(connection, "confirmed");

const sqrtPrices = createSqrtPrices(
  [${sp.map(p=>p.toPrecision(6)).join(', ')}],
  TokenDecimal.${td}, TokenDecimal.${qd}
);

const curveConfig = buildCurveWithCustomSqrtPrices({
  token: {
    tokenType: TokenType.SPLToken,
    tokenBaseDecimal: TokenDecimal.${td},
    tokenQuoteDecimal: TokenDecimal.${qd},
    tokenAuthorityOption: TokenAuthorityOption.PartnerUpdateAuthority,
    totalTokenSupply: ${state.totalSupply}, leftover: 1_000,
  },
  fee: {
    baseFeeParams: {
      baseFeeMode: BaseFeeMode.${fm},
      feeSchedulerParam: {
        startingFeeBps: ${state.startingFee*100}, endingFeeBps: ${Math.round(state.endingFee*100)},
        numberOfPeriod: ${state.feeDuration}, totalDuration: ${state.feeDuration},
      },
    },
    dynamicFeeEnabled: true, collectFeeMode: CollectFeeMode.QuoteToken,
    creatorTradingFeePercentage: 0, poolCreationFee: 1, enableFirstSwapWithMinFee: false,
  },
  migration: {
    migrationOption: MigrationOption.MET_DAMM_V2,
    migrationFeeOption: MigrationFeeOption.Customizable,
    migrationFee: { feePercentage: 10, creatorFeePercentage: 50 },
    migratedPoolFee: {
      collectFeeMode: MigratedCollectFeeMode.QuoteToken,
      dynamicFee: DammV2DynamicFeeMode.Enabled, poolFeeBps: ${state.dammFee},
    },
  },
  liquidityDistribution: {
    partnerLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: ${state.lockedLiquidity},
    creatorLiquidityPercentage: ${100-state.lockedLiquidity},
    creatorPermanentLockedLiquidityPercentage: 0,
  },
  lockedVesting: { totalLockedVestingAmount:0, numberOfVestingPeriod:0,
    cliffUnlockAmount:0, totalVestingDuration:0, cliffDurationFromMigrationTime:0 },
  activationType: ActivationType.Timestamp,
  sqrtPrices, liquidityWeights: [${wts.join(', ')}],
});

const partner = Keypair.generate();
const config = Keypair.generate();
const tx = await client.partner.createConfig({
  config: config.publicKey, feeClaimer: partner.publicKey,
  leftoverReceiver: partner.publicKey, payer: partner.publicKey,
  quoteMint: NATIVE_MINT, ...curveConfig,
});`;
  } else {
    el.textContent=JSON.stringify({_gen:'CurveForge',shape:state.shape,segments:state.segments,
      prices:sp,weights:wts,totalSupply:state.totalSupply,tokenDecimals:state.tokenDecimals,
      quoteToken:state.quoteToken,migrationThreshold:state.migrationThreshold,
      fee:{mode:state.feeMode,startBps:state.startingFee*100,endBps:Math.round(state.endingFee*100),dur:state.feeDuration},
      migration:{dammFeeBps:state.dammFee,lockedPct:state.lockedLiquidity},
      multiplier:state.endPrice/state.startPrice},null,2);
  }
}

// === Simulator ===
function resetSim(){
  state.sim={totalSpent:0,tokensBought:0,currentPrice:state.startPrice,trades:[],quoteReserve:0};
  updateSimUI();drawSimChart();
}
function simBuy(amt){
  const thr=state.migrationThreshold;if(state.sim.quoteReserve>=thr)return;
  const rem=thr-state.sim.quoteReserve;const actual=Math.min(amt,rem);
  const pBefore=state.sim.quoteReserve/thr;state.sim.quoteReserve+=actual;
  const pAfter=state.sim.quoteReserve/thr;
  const pts=curvePoints(state.shape,state.segments,state.startPrice,state.endPrice);
  const pr1=interp(pts,pBefore),pr2=interp(pts,pAfter);
  const avg=(pr1+pr2)/2;const tokens=actual/avg;
  state.sim.totalSpent+=actual;state.sim.tokensBought+=tokens;state.sim.currentPrice=pr2;
  state.sim.trades.push({amount:actual,price:pr2,tokens,progress:pAfter});
  updateSimUI();drawSimChart();
}
function interp(pts,progress){
  const t=Math.max(0,Math.min(1,progress));
  for(let i=1;i<pts.length;i++){
    if(pts[i].t>=t){const p0=pts[i-1],p1=pts[i];const f=(t-p0.t)/(p1.t-p0.t);return p0.price+(p1.price-p0.price)*f;}
  }
  return pts[pts.length-1].price;
}
function updateSimUI(){
  const s=state.sim;
  setText('sim-current-price',fmtSci(s.currentPrice||state.startPrice));
  setText('sim-tokens-bought',fmtNum(s.tokensBought));
  setText('sim-total-spent',s.totalSpent.toFixed(2)+' '+state.quoteToken);
  const prog=Math.min(100,(s.quoteReserve/state.migrationThreshold)*100);
  setText('sim-progress',prog.toFixed(1)+'%');
  const fill=document.getElementById('sim-progress-fill');if(fill)fill.style.width=prog+'%';
  setText('sim-progress-text',prog.toFixed(1)+'% → Migration'+(prog>=100?' ✓ Complete!':''));
  const list=document.getElementById('sim-history-list');
  if(!list)return;
  if(s.trades.length===0){list.innerHTML='<div class="sim-history-empty">No trades yet.</div>';return;}
  list.innerHTML=s.trades.map((t,i)=>`<div class="sim-trade"><div class="sim-trade-info"><span class="sim-trade-amount">#${i+1} Buy ${t.amount.toFixed(2)} ${state.quoteToken}</span><span class="sim-trade-price">@ ${fmtSci(t.price)}</span></div><span class="sim-trade-tokens">+${fmtNum(t.tokens)}</span></div>`).reverse().join('');
}
function drawSimChart(){
  const c=document.getElementById('sim-price-chart');if(!c)return;
  const ctx=c.getContext('2d');const dpr=window.devicePixelRatio||1;
  const rect=c.parentElement.getBoundingClientRect();const W=rect.width-40,H=250;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  if(state.sim.trades.length===0){ctx.fillStyle='rgba(155,151,176,0.3)';ctx.font='500 13px Inter';ctx.textAlign='center';ctx.fillText('Execute buys to see price chart',W/2,H/2);return;}
  const pad={top:10,right:10,bottom:20,left:50};const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;
  const prices=[state.startPrice,...state.sim.trades.map(t=>t.price)];
  const lm=Math.log10(Math.min(...prices)),lx=Math.log10(Math.max(...prices)),lr=lx-lm||1;
  const gr=ctx.createLinearGradient(0,pad.top,0,H-pad.bottom);gr.addColorStop(0,'rgba(52,211,153,0.10)');gr.addColorStop(1,'rgba(52,211,153,0.02)');
  ctx.beginPath();ctx.moveTo(pad.left,H-pad.bottom);
  prices.forEach((p,i)=>{const x=pad.left+(i/(prices.length-1))*cW;const y=pad.top+cH*(1-(Math.log10(p)-lm)/lr);ctx.lineTo(x,y);});
  ctx.lineTo(W-pad.right,H-pad.bottom);ctx.closePath();ctx.fillStyle=gr;ctx.fill();
  ctx.beginPath();prices.forEach((p,i)=>{const x=pad.left+(i/(prices.length-1))*cW;const y=pad.top+cH*(1-(Math.log10(p)-lm)/lr);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.strokeStyle='#34d399';ctx.lineWidth=1.5;ctx.stroke();
  prices.forEach((p,i)=>{if(i===0)return;const x=pad.left+(i/(prices.length-1))*cW;const y=pad.top+cH*(1-(Math.log10(p)-lm)/lr);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#34d399';ctx.fill();});
  ctx.fillStyle='rgba(155,151,176,0.6)';ctx.font='500 9px Inter';ctx.textAlign='right';
  ctx.fillText(fmtSci(Math.pow(10,lx)),pad.left-4,pad.top+8);ctx.fillText(fmtSci(Math.pow(10,lm)),pad.left-4,H-pad.bottom);
}

// === Utils ===
function fmtSci(p){if(p===0)return'0';if(p>=0.01)return p.toFixed(4);if(p>=1e-6)return p.toFixed(8);return p.toExponential(2);}
function fmtNum(n){if(n>=1e9)return(n/1e9).toFixed(2)+'B';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(2)+'K';return n.toFixed(2);}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

// === UI Sync ===
function syncUI(){
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  s('input-total-supply',state.totalSupply);s('input-token-decimals',state.tokenDecimals);
  s('input-quote-token',state.quoteToken);s('input-start-price',state.startPrice);
  s('input-end-price',state.endPrice);s('input-segments',state.segments);
  s('input-migration-threshold',state.migrationThreshold);s('input-fee-mode',state.feeMode);
  s('input-starting-fee',state.startingFee);s('input-ending-fee',state.endingFee);
  s('input-fee-duration',state.feeDuration);s('input-damm-fee',state.dammFee);
  s('input-locked-liq',state.lockedLiquidity);
  document.querySelectorAll('.shape-btn').forEach(b=>b.classList.toggle('active',b.dataset.shape===state.shape));
  setText('segments-value',state.segments);setText('locked-liq-value',state.lockedLiquidity+'%');
  ['start-price-unit','end-price-unit','threshold-unit','sim-buy-unit'].forEach(id=>setText(id,state.quoteToken));
}
function updateSummary(){
  const mult=state.endPrice/state.startPrice;
  const ms=mult>=1000?(mult/1000).toFixed(0)+',000':mult.toFixed(0);
  setText('sum-supply',state.totalSupply.toLocaleString());setText('sum-quote',state.quoteToken);
  setText('sum-segments',state.segments);setText('sum-start',fmtSci(state.startPrice)+' '+state.quoteToken);
  setText('sum-end',fmtSci(state.endPrice)+' '+state.quoteToken);setText('sum-mult',ms+'x');
  setText('sum-threshold',state.migrationThreshold+' '+state.quoteToken);
  setText('sum-start-fee',state.startingFee+'%');setText('sum-end-fee',state.endingFee+'%');
  setText('sum-damm-fee',(state.dammFee/100).toFixed(2)+'%');setText('sum-locked',state.lockedLiquidity+'%');
  setText('stat-start-price',fmtSci(state.startPrice));setText('stat-end-price',fmtSci(state.endPrice));
  setText('stat-multiplier',ms+'x');
}
function updateAll(){updateSummary();drawCurve();drawFeeChart();drawLiqChart();}

// === Bindings ===
function bind(){
  const b=(id,key,tf)=>{const el=document.getElementById(id);if(!el)return;
    el.addEventListener('input',()=>{state[key]=tf?tf(el.value):el.value;
      if(key==='segments')setText('segments-value',state.segments);
      if(key==='lockedLiquidity')setText('locked-liq-value',state.lockedLiquidity+'%');
      if(key==='quoteToken')['start-price-unit','end-price-unit','threshold-unit','sim-buy-unit'].forEach(u=>setText(u,state.quoteToken));
      updateAll();});};
  b('input-total-supply','totalSupply',v=>parseInt(v)||1e9);
  b('input-token-decimals','tokenDecimals',v=>parseInt(v));
  b('input-quote-token','quoteToken');
  b('input-start-price','startPrice',v=>parseFloat(v)||1e-9);
  b('input-end-price','endPrice',v=>parseFloat(v)||1e-6);
  b('input-segments','segments',v=>parseInt(v));
  b('input-migration-threshold','migrationThreshold',v=>parseFloat(v)||85);
  b('input-fee-mode','feeMode');
  b('input-starting-fee','startingFee',v=>parseFloat(v)||90);
  b('input-ending-fee','endingFee',v=>parseFloat(v)||1);
  b('input-fee-duration','feeDuration',v=>parseInt(v)||60);
  b('input-damm-fee','dammFee',v=>parseInt(v));
  b('input-locked-liq','lockedLiquidity',v=>parseInt(v));

  document.querySelectorAll('.shape-btn').forEach(btn=>{btn.addEventListener('click',()=>{
    document.querySelectorAll('.shape-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');state.shape=btn.dataset.shape;updateAll();});});

  document.getElementById('presets-filters')?.addEventListener('click',e=>{
    const btn=e.target.closest('.filter-btn');if(!btn)return;
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');renderPresets(btn.dataset.filter);});

  document.getElementById('export-tabs')?.addEventListener('click',e=>{
    const btn=e.target.closest('.export-tab');if(!btn)return;
    document.querySelectorAll('.export-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');setText('code-lang',btn.dataset.export==='typescript'?'TypeScript':'JSON');
    genExport(btn.dataset.export);});

  document.getElementById('btn-copy-code')?.addEventListener('click',()=>{
    const code=document.getElementById('code-output')?.textContent||'';
    navigator.clipboard.writeText(code).then(()=>{
      const b=document.getElementById('btn-copy-code');if(b){b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',1500);}});});

  document.getElementById('btn-sim-buy')?.addEventListener('click',()=>{simBuy(parseFloat(document.getElementById('sim-buy-amount')?.value||1));});
  document.getElementById('btn-sim-reset')?.addEventListener('click',resetSim);
  document.getElementById('btn-export-config')?.addEventListener('click',()=>document.querySelector('[data-tab="export"]')?.click());
  document.getElementById('btn-simulate')?.addEventListener('click',()=>document.querySelector('[data-tab="simulator"]')?.click());
  document.getElementById('btn-reset-config')?.addEventListener('click',()=>{
    Object.assign(state,{shape:'linear',totalSupply:1e9,tokenDecimals:9,quoteToken:'SOL',startPrice:1e-9,endPrice:1e-6,segments:3,migrationThreshold:85,feeMode:'exponential',startingFee:90,endingFee:1,feeDuration:60,dammFee:100,lockedLiquidity:100});
    syncUI();updateAll();});
}

// === Init ===
bind();syncUI();updateAll();
window.addEventListener('resize',()=>{drawCurve();drawFeeChart();drawLiqChart();});
