/* ═══════════════════════════════════════════
   BITCOIN WALLET VISUALIZER — APP LOGIC
   ═══════════════════════════════════════════ */

// ══════════════════════════════════════
//   BALANCE CARD GLOW EFFECT
// ══════════════════════════════════════
(function initBalanceGlow() {
    document.addEventListener('DOMContentLoaded', () => {
        const card = document.querySelector('.balance-card');
        if (!card) return;

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--glow-x', x + 'px');
            card.style.setProperty('--glow-y', y + 'px');
            card.style.setProperty('--glow-opacity', '1');
        });

        card.addEventListener('mouseleave', () => {
            card.style.setProperty('--glow-opacity', '0.5');
            card.style.setProperty('--glow-x', '85%');
            card.style.setProperty('--glow-y', '20%');
        });
    });
})();

// ── Demo transactions ──
const DEMO_TRANSACTIONS = [
    { date: '2024-01-15', amountEur: 200, priceBtc: 39800 },
    { date: '2024-03-10', amountEur: 150, priceBtc: 62500 },
    { date: '2024-05-02', amountEur: 300, priceBtc: 57200 },
    { date: '2024-07-20', amountEur: 100, priceBtc: 59800 },
    { date: '2024-09-14', amountEur: 250, priceBtc: 54100 },
    { date: '2024-11-08', amountEur: 500, priceBtc: 69500 },
    { date: '2025-01-22', amountEur: 200, priceBtc: 92300 },
    { date: '2025-04-05', amountEur: 350, priceBtc: 78400 },
    { date: '2025-08-18', amountEur: 150, priceBtc: 96700 },
    { date: '2025-11-30', amountEur: 400, priceBtc: 88200 },
];

// ── State ──
let transactions = [];
let btcPriceHistory = []; // { date, price }
let currentBtcPrice = 0;
let mainChart = null;
let activeTab = 'portfolio';
let activeRange = 365;
let walletMode = null;   // 'api' | 'manual'
let walletAddress = null;

// ══════════════════════════════════════
//   INIT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Always hide config overlay initially
    document.getElementById('configOverlay').classList.add('hidden');

    // ── Search bar events ──
    document.getElementById('searchBtn').addEventListener('click', () => {
        const addr = document.getElementById('addressInput').value.trim();
        if (addr) { hideOnboarding(); searchAddress(addr); }
    });
    document.getElementById('addressInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const addr = e.target.value.trim();
            if (addr) { hideOnboarding(); searchAddress(addr); }
        }
    });

    // ── Config modal events ──
    document.getElementById('loadDemoBtn').addEventListener('click', loadDemo);
    document.getElementById('addRowBtn').addEventListener('click', () => addTxRow());
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('fabConfig').addEventListener('click', showConfig);

    // Chart tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            updateChartDescription();
            renderChart();
        });
    });

    // Range buttons
    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeRange = parseInt(btn.dataset.range);
            renderChart();
        });
    });

    // ── Check URL for address (supports /address and #address) ──
    const urlAddress = getAddressFromURL();

    if (urlAddress) {
        document.getElementById('addressInput').value = urlAddress;
        hideOnboarding();
        searchAddress(urlAddress);
    } else {
        // Restore saved state
        const savedAddress = localStorage.getItem('btc_address');
        const savedTx = localStorage.getItem('btc_transactions');

        if (savedAddress) {
            document.getElementById('addressInput').value = savedAddress;
            hideOnboarding();
            searchAddress(savedAddress);
        } else if (savedTx) {
            transactions = JSON.parse(savedTx);
            walletMode = 'manual';
            hideOnboarding();
            boot();
        } else {
            showOnboarding();
        }
    }

    // Listen for hash changes (e.g. user edits URL)
    window.addEventListener('hashchange', () => {
        const addr = getAddressFromURL();
        if (addr) {
            document.getElementById('addressInput').value = addr;
            hideOnboarding();
            searchAddress(addr);
        }
    });
});

// ══════════════════════════════════════
//   BOOT — Load price data & render
// ══════════════════════════════════════
async function boot() {
    await fetchPriceHistory();
    computeAndRender();
}

// ══════════════════════════════════════
//   FETCH BTC PRICE HISTORY (CoinGecko)
// ══════════════════════════════════════
async function fetchPriceHistory() {
    try {
        // Determine how far back we need data
        const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sortedTx[0].date);
        const now = new Date();
        const diffDays = Math.ceil((now - firstDate) / (1000 * 60 * 60 * 24)) + 30;
        const days = Math.max(diffDays, 365);

        const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=${days}&interval=daily`;
        const res = await fetch(url);
        const data = await res.json();

        btcPriceHistory = data.prices.map(([ts, price]) => ({
            date: new Date(ts),
            price: price
        }));

        // Current price = last known
        currentBtcPrice = btcPriceHistory[btcPriceHistory.length - 1].price;
    } catch (e) {
        console.warn('CoinGecko API unavailable, using simulated prices', e);
        generateSimulatedPrices();
    }
}

function generateSimulatedPrices() {
    // Fallback: generate realistic-looking BTC price history in EUR
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const startDate = new Date(sortedTx[0].date);
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    btcPriceHistory = [];

    let price = sortedTx[0].priceBtc || 40000;
    const d = new Date(startDate);
    while (d <= endDate) {
        // Random walk with upward bias
        const change = (Math.random() - 0.47) * price * 0.025;
        price = Math.max(price + change, 15000);
        btcPriceHistory.push({ date: new Date(d), price: Math.round(price) });
        d.setDate(d.getDate() + 1);
    }
    currentBtcPrice = btcPriceHistory[btcPriceHistory.length - 1].price;
}

// ══════════════════════════════════════
//   SEARCH BY ADDRESS (Blockstream API)
// ══════════════════════════════════════
async function searchAddress(address) {
    const statusEl = document.getElementById('searchStatus');
    const searchBtn = document.getElementById('searchBtn');
    const searchBtnText = searchBtn.querySelector('.search-btn-text');
    const searchLoader = document.getElementById('searchLoader');

    // Basic format validation
    if (!isValidBtcAddress(address)) {
        statusEl.textContent = '✗ Format d\'adresse invalide. Utilisez une adresse commençant par bc1, 1 ou 3.';
        statusEl.className = 'search-status error';
        return;
    }

    // UI: loading state
    searchBtn.disabled = true;
    searchBtnText.textContent = 'Recherche…';
    searchLoader.classList.remove('hidden');
    statusEl.textContent = '🔍 Recherche de l\'adresse sur la blockchain…';
    statusEl.className = 'search-status';

    try {
        // 1. Fetch address summary
        statusEl.textContent = '🔍 Récupération des informations du portefeuille…';
        const addrData = await fetchAddressInfo(address);

        const balanceSats = addrData.chain_stats.funded_txo_sum - addrData.chain_stats.spent_txo_sum;
        const balanceBtc = balanceSats / 1e8;
        const txCount = addrData.chain_stats.tx_count;

        if (txCount === 0) {
            statusEl.textContent = '✗ Cette adresse n\'a aucune transaction.';
            statusEl.className = 'search-status error';
            resetSearchBtn();
            return;
        }

        // 2. Fetch all transactions
        statusEl.textContent = `📦 Chargement des transactions (0/${txCount})…`;
        const rawTxs = await fetchAllTransactions(address, (loaded) => {
            statusEl.textContent = `📦 Chargement des transactions (${loaded}/${txCount})…`;
        });

        // 3. Process transactions
        statusEl.textContent = '⚙️ Traitement des transactions…';
        const processedTxs = processBlockstreamTxs(rawTxs, address);

        // 4. Set transactions and fetch price history
        transactions = processedTxs;
        walletMode = 'api';
        walletAddress = address;

        statusEl.textContent = '📈 Récupération de l\'historique des prix BTC/EUR…';
        await fetchPriceHistory();

        // 5. Enrich transactions with EUR prices
        transactions.forEach(tx => {
            const closest = findClosestPrice(new Date(tx.date), btcPriceHistory);
            tx.priceBtc = closest ? closest.price : currentBtcPrice;
            tx.amountEur = tx.btcQty * tx.priceBtc;
        });

        // 6. Save & render
        localStorage.setItem('btc_address', address);
        localStorage.removeItem('btc_transactions');
        pushAddressToURL(address);
        hideOnboarding();

        const nbReceives = processedTxs.filter(t => t.type === 'receive').length;
        const nbSends = processedTxs.filter(t => t.type === 'send').length;
        let summary = `✓ ${processedTxs.length} transactions trouvées`;
        if (nbSends > 0) summary += ` (${nbReceives} réceptions, ${nbSends} envois)`;
        summary += ` · Solde : ${balanceBtc.toFixed(8)} BTC`;
        statusEl.textContent = summary;
        statusEl.className = 'search-status success';

        computeAndRender();

        // Update footer
        document.querySelector('.footer p').innerHTML =
            'Données en temps réel via <span class="accent">Blockstream API</span> · Prix via CoinGecko · <span class="accent">₿</span> Bitcoin Wallet Viewer';

    } catch (err) {
        console.error('Search error:', err);
        statusEl.textContent = `✗ Erreur : ${err.message}`;
        statusEl.className = 'search-status error';
    } finally {
        resetSearchBtn();
    }
}

function resetSearchBtn() {
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.disabled = false;
    searchBtn.querySelector('.search-btn-text').textContent = 'Explorer';
    document.getElementById('searchLoader').classList.add('hidden');
}

// ══════════════════════════════════════
//   URL ROUTING
// ══════════════════════════════════════
function getAddressFromURL() {
    // Support: /#bc1q... or /bc1q... or ?address=bc1q...
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && isValidBtcAddress(hash)) return hash;

    const path = window.location.pathname.replace(/^\//, '').trim();
    if (path && isValidBtcAddress(path)) return path;

    const params = new URLSearchParams(window.location.search);
    const addrParam = (params.get('address') || '').trim();
    if (addrParam && isValidBtcAddress(addrParam)) return addrParam;

    return null;
}

function pushAddressToURL(address) {
    if (window.location.hash.replace('#', '') !== address) {
        history.replaceState(null, '', '#' + address);
    }
}

// ══════════════════════════════════════
//   ONBOARDING
// ══════════════════════════════════════
function showOnboarding() {
    const el = document.getElementById('onboarding');
    const main = document.getElementById('mainContent');
    if (el) el.classList.remove('hidden');
    if (main) main.classList.add('main-hidden');
}

function hideOnboarding() {
    const el = document.getElementById('onboarding');
    const main = document.getElementById('mainContent');
    if (el) el.classList.add('hidden');
    if (main) main.classList.remove('main-hidden');
}

function isValidBtcAddress(addr) {
    return /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr) ||
           /^bc1[a-zA-HJ-NP-Z0-9]{25,90}$/i.test(addr);
}

// ══════════════════════════════════════
//   BLOCKSTREAM API
// ══════════════════════════════════════
async function fetchAddressInfo(address) {
    const res = await fetch(`https://blockstream.info/api/address/${address}`);
    if (!res.ok) {
        if (res.status === 400) throw new Error('Adresse Bitcoin invalide');
        throw new Error(`Erreur API (${res.status})`);
    }
    return res.json();
}

async function fetchAllTransactions(address, onProgress) {
    let allTxs = [];
    let lastTxid = null;

    while (true) {
        const url = lastTxid
            ? `https://blockstream.info/api/address/${address}/txs/chain/${lastTxid}`
            : `https://blockstream.info/api/address/${address}/txs`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erreur lors du chargement des transactions (${res.status})`);

        const batch = await res.json();
        if (batch.length === 0) break;

        allTxs = allTxs.concat(batch);
        if (onProgress) onProgress(allTxs.length);

        if (batch.length < 25) break;

        lastTxid = batch[batch.length - 1].txid;

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 350));
    }

    return allTxs;
}

function processBlockstreamTxs(rawTxs, address) {
    return rawTxs
        .filter(tx => tx.status && tx.status.confirmed)
        .map(tx => {
            const incoming = tx.vout
                .filter(out => out.scriptpubkey_address === address)
                .reduce((sum, out) => sum + out.value, 0);

            const outgoing = tx.vin
                .filter(inp => inp.prevout && inp.prevout.scriptpubkey_address === address)
                .reduce((sum, inp) => sum + inp.prevout.value, 0);

            const netSatoshis = incoming - outgoing;
            const btcQty = Math.abs(netSatoshis) / 1e8;
            const type = netSatoshis >= 0 ? 'receive' : 'send';
            const timestamp = tx.status.block_time;
            const dateObj = new Date(timestamp * 1000);

            return {
                date: dateObj.toISOString().split('T')[0],
                btcQty,
                type,
                txid: tx.txid,
                amountEur: 0,
                priceBtc: 0
            };
        })
        .filter(tx => tx.btcQty > 0.00000001)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ══════════════════════════════════════
//   COMPUTE & RENDER ALL
// ══════════════════════════════════════
function computeAndRender() {
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Ensure btcQty and type are set (backwards compat with manual mode)
    sortedTx.forEach(tx => {
        if (!tx.btcQty) tx.btcQty = tx.amountEur / tx.priceBtc;
        if (!tx.type) tx.type = 'receive';
    });

    const receives = sortedTx.filter(tx => tx.type === 'receive');
    const sends = sortedTx.filter(tx => tx.type === 'send');

    const totalBtcReceived = receives.reduce((s, tx) => s + tx.btcQty, 0);
    const totalBtcSent = sends.reduce((s, tx) => s + tx.btcQty, 0);
    const totalBtc = totalBtcReceived - totalBtcSent;

    const totalInvested = receives.reduce((s, tx) => s + tx.amountEur, 0);
    const totalWithdrawn = sends.reduce((s, tx) => s + tx.amountEur, 0);

    const currentValue = totalBtc * currentBtcPrice;
    const netCost = totalInvested - totalWithdrawn;
    const profitLoss = currentValue - netCost;
    const returnPct = netCost > 0 ? ((currentValue / netCost) - 1) * 100 : 0;

    // ── Update Header ──
    document.getElementById('livePrice').textContent = formatEur(currentBtcPrice);

    // ── Update Balance ──
    document.getElementById('balanceValue').textContent = formatEur(currentValue);
    document.getElementById('btcAmount').textContent = totalBtc.toFixed(8) + ' BTC';
    document.getElementById('btcPrice').textContent = '@ ' + formatEur(currentBtcPrice) + '/BTC';
    document.getElementById('totalInvested').textContent = formatEur(totalInvested);

    const plEl = document.getElementById('profitLoss');
    plEl.textContent = (profitLoss >= 0 ? '+' : '') + formatEur(profitLoss);
    plEl.style.color = profitLoss >= 0 ? 'var(--green)' : 'var(--red)';

    const retEl = document.getElementById('returnPct');
    retEl.textContent = (returnPct >= 0 ? '+' : '') + returnPct.toFixed(1) + '%';
    retEl.style.color = returnPct >= 0 ? 'var(--green)' : 'var(--red)';

    const badge = document.getElementById('badgeChange');
    badge.textContent = (returnPct >= 0 ? '▲ +' : '▼ ') + returnPct.toFixed(1) + '%';
    badge.classList.toggle('negative', returnPct < 0);

    // ── Info cards ──
    document.getElementById('nbBuys').textContent = receives.length + (sends.length > 0 ? ` / ${sends.length}` : '');
    document.getElementById('totalBtc').textContent = totalBtc.toFixed(8) + ' BTC';
    const avgPrice = totalBtc > 0 ? totalInvested / totalBtcReceived : 0;
    document.getElementById('avgPrice').textContent = formatEur(avgPrice);

    // ── Chart ──
    renderChart();
    updateChartDescription();

    // ── Transaction table ──
    renderTransactionTable(sortedTx);
}

// ══════════════════════════════════════
//   CHART
// ══════════════════════════════════════
function renderChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');

    if (mainChart) {
        mainChart.destroy();
    }

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedTx.forEach(tx => {
        if (!tx.btcQty) tx.btcQty = tx.amountEur / tx.priceBtc;
        if (!tx.type) tx.type = 'receive';
    });

    const receives = sortedTx.filter(tx => tx.type === 'receive');
    const sends = sortedTx.filter(tx => tx.type === 'send');
    const totalBtcNow = receives.reduce((s, tx) => s + tx.btcQty, 0)
                      - sends.reduce((s, tx) => s + tx.btcQty, 0);

    // Filter price history by range
    let filteredPrices = [...btcPriceHistory];
    if (activeRange > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - activeRange);
        filteredPrices = filteredPrices.filter(p => p.date >= cutoff);
    }

    if (activeTab === 'portfolio') {
        renderPortfolioChart(ctx, filteredPrices, sortedTx);
    } else if (activeTab === 'impact') {
        renderImpactChart(ctx, filteredPrices, totalBtcNow, sortedTx);
    } else if (activeTab === 'compare') {
        renderComparisonChart(ctx, filteredPrices, sortedTx);
    }
}

function renderPortfolioChart(ctx, prices, sortedTx) {
    // Determine visible date range
    const rangeStart = prices.length > 0 ? prices[0].date : new Date(0);
    const rangeEnd = prices.length > 0 ? prices[prices.length - 1].date : new Date();

    // Build portfolio value over time — handle both receives and sends
    const data = prices.map(p => {
        let btcHeld = 0;
        for (const tx of sortedTx) {
            if (new Date(tx.date) <= p.date) {
                if (tx.type === 'send') btcHeld -= tx.btcQty;
                else btcHeld += tx.btcQty;
            }
        }
        return { x: p.date, y: Math.round(Math.max(0, btcHeld) * p.price * 100) / 100 };
    });

    // Build invested line (step function — receives only)
    const investedData = prices.map(p => {
        let invested = 0;
        for (const tx of sortedTx) {
            if (new Date(tx.date) <= p.date && tx.type !== 'send') {
                invested += tx.amountEur;
            }
        }
        return { x: p.date, y: invested };
    });

    // Buy markers (receives) — only within visible range
    const receives = sortedTx.filter(tx => tx.type !== 'send');
    const buyPoints = receives
        .filter(tx => new Date(tx.date) >= rangeStart && new Date(tx.date) <= rangeEnd)
        .map(tx => {
            let btcHeld = 0;
            for (const t of sortedTx) {
                if (new Date(t.date) <= new Date(tx.date)) {
                    btcHeld += t.type === 'send' ? -t.btcQty : t.btcQty;
                }
            }
            const closest = findClosestPrice(new Date(tx.date), prices);
            return { x: new Date(tx.date), y: Math.round(Math.max(0, btcHeld) * (closest ? closest.price : tx.priceBtc) * 100) / 100 };
        });

    // Sell markers (sends) — only within visible range
    const sends = sortedTx.filter(tx => tx.type === 'send');
    const sellPoints = sends
        .filter(tx => new Date(tx.date) >= rangeStart && new Date(tx.date) <= rangeEnd)
        .map(tx => {
            let btcHeld = 0;
            for (const t of sortedTx) {
                if (new Date(t.date) <= new Date(tx.date)) {
                    btcHeld += t.type === 'send' ? -t.btcQty : t.btcQty;
                }
            }
            const closest = findClosestPrice(new Date(tx.date), prices);
            return { x: new Date(tx.date), y: Math.round(Math.max(0, btcHeld) * (closest ? closest.price : tx.priceBtc) * 100) / 100 };
        });

    const orangeGrad = ctx.createLinearGradient(0, 0, 0, 380);
    orangeGrad.addColorStop(0, 'rgba(247, 147, 26, 0.3)');
    orangeGrad.addColorStop(1, 'rgba(247, 147, 26, 0.0)');

    const datasets = [
                {
                    label: 'Valeur du portefeuille (€)',
                    data: data,
                    borderColor: '#F7931A',
                    borderWidth: 2.5,
                    backgroundColor: orangeGrad,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#F7931A',
                    tension: 0.3,
                    order: 2
                },
                {
                    label: 'Total investi (€)',
                    data: investedData,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: 'rgba(255,255,255,0.5)',
                    tension: 0,
                    order: 3
                },
                {
                    label: 'Réceptions',
                    data: buyPoints,
                    type: 'scatter',
                    backgroundColor: '#00D68F',
                    borderColor: '#00D68F',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointStyle: 'triangle',
                    order: 0
                }
            ];

    // Add sell markers if there are sends
    if (sellPoints.length > 0) {
        datasets.push({
            label: 'Envois',
            data: sellPoints,
            type: 'scatter',
            backgroundColor: '#FF6B6B',
            borderColor: '#FF6B6B',
            pointRadius: 6,
            pointHoverRadius: 8,
            pointStyle: 'crossRot',
            order: 1
        });
    }

    mainChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: chartOptions('€')
    });

    const legendItems = [
        { color: '#F7931A', label: 'Valeur du portefeuille' },
        { color: 'rgba(255,255,255,0.25)', label: 'Total investi', dashed: true },
        { color: '#00D68F', label: 'Réception de BTC', shape: 'triangle' }
    ];
    if (sellPoints.length > 0) {
        legendItems.push({ color: '#FF6B6B', label: 'Envoi de BTC', shape: 'cross' });
    }
    updateLegend(legendItems);
}

function renderImpactChart(ctx, prices, totalBtcNow, sortedTx) {
    // This chart shows: what is the value of the CURRENT quantity of BTC over time
    const data = prices.map(p => ({
        x: p.date,
        y: Math.round(Math.max(0, totalBtcNow) * p.price * 100) / 100
    }));

    // Total invested (receives only)
    const totalInvested = sortedTx
        .filter(tx => tx.type !== 'send')
        .reduce((s, tx) => s + tx.amountEur, 0);
    const totalWithdrawn = sortedTx
        .filter(tx => tx.type === 'send')
        .reduce((s, tx) => s + tx.amountEur, 0);
    const netCost = totalInvested - totalWithdrawn;

    const investedLine = prices.map(p => ({
        x: p.date,
        y: netCost
    }));

    const orangeGrad = ctx.createLinearGradient(0, 0, 0, 380);
    orangeGrad.addColorStop(0, 'rgba(247, 147, 26, 0.25)');
    orangeGrad.addColorStop(1, 'rgba(247, 147, 26, 0.0)');

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: `Valeur de ${totalBtcNow.toFixed(6)} BTC (€)`,
                    data: data,
                    borderColor: '#F7931A',
                    borderWidth: 2.5,
                    backgroundColor: orangeGrad,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#F7931A',
                    tension: 0.3,
                },
                {
                    label: 'Total investi (€)',
                    data: investedLine,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    tension: 0,
                }
            ]
        },
        options: chartOptions('€')
    });

    updateLegend([
        { color: '#F7931A', label: `Valeur de vos ${totalBtcNow.toFixed(6)} BTC` },
        { color: 'rgba(255,255,255,0.25)', label: 'Votre investissement total', dashed: true }
    ]);
}

// ══════════════════════════════════════
//   COMPARISON CHART — Livret A & Inflation
// ══════════════════════════════════════

// Livret A annual rates (source: Banque de France)
// Changed semi-annually; using effective rate per period
const LIVRET_A_RATES = [
    { from: '2015-08-01', rate: 0.0075 },
    { from: '2020-02-01', rate: 0.005  },
    { from: '2022-02-01', rate: 0.01   },
    { from: '2022-08-01', rate: 0.02   },
    { from: '2023-02-01', rate: 0.03   },
    { from: '2025-02-01', rate: 0.024  },
];

// France annual inflation rates (source: INSEE CPI)
// Monthly approximate rates are interpolated from annual figures
const INFLATION_ANNUAL = [
    { year: 2015, rate: 0.001 },
    { year: 2016, rate: 0.002 },
    { year: 2017, rate: 0.010 },
    { year: 2018, rate: 0.018 },
    { year: 2019, rate: 0.011 },
    { year: 2020, rate: 0.005 },
    { year: 2021, rate: 0.016 },
    { year: 2022, rate: 0.052 },
    { year: 2023, rate: 0.049 },
    { year: 2024, rate: 0.020 },
    { year: 2025, rate: 0.015 },
    { year: 2026, rate: 0.015 },
];

function getLivretARate(date) {
    let rate = 0.005; // default fallback
    for (const entry of LIVRET_A_RATES) {
        if (date >= new Date(entry.from)) rate = entry.rate;
    }
    return rate;
}

function getInflationRate(date) {
    const year = date.getFullYear();
    const entry = INFLATION_ANNUAL.find(e => e.year === year);
    return entry ? entry.rate : 0.015; // fallback ~1.5%
}

function renderComparisonChart(ctx, prices, sortedTx) {
    if (prices.length === 0) return;

    const receives = sortedTx.filter(tx => tx.type !== 'send');

    // ── Build Bitcoin portfolio value over time ──
    const btcData = prices.map(p => {
        let btcHeld = 0;
        for (const tx of sortedTx) {
            if (new Date(tx.date) <= p.date) {
                btcHeld += tx.type === 'send' ? -tx.btcQty : tx.btcQty;
            }
        }
        return { x: p.date, y: Math.round(Math.max(0, btcHeld) * p.price * 100) / 100 };
    });

    // ── Build Livret A simulation ──
    // For each price date, calculate what the total would be if each deposit
    // (same EUR amounts, same dates) was put in a Livret A instead
    const livretData = prices.map(p => {
        let total = 0;
        for (const tx of receives) {
            const txDate = new Date(tx.date);
            if (txDate > p.date) continue;

            // Compound day by day from txDate to p.date using applicable Livret A rates
            let amount = tx.amountEur;
            const d = new Date(txDate);
            // Approximate: use daily compounding per applicable rate period
            const daysHeld = Math.max(0, (p.date - txDate) / (1000 * 60 * 60 * 24));
            // Use the average applicable rate over the period (simplified)
            // For accuracy, we compute in yearly chunks
            let remaining = daysHeld;
            let cursor = new Date(txDate);
            while (remaining > 0) {
                const rate = getLivretARate(cursor);
                const dailyRate = rate / 365;
                // How many days at this rate? Until next rate change or end
                let nextChange = null;
                for (const entry of LIVRET_A_RATES) {
                    const entryDate = new Date(entry.from);
                    if (entryDate > cursor) {
                        nextChange = entryDate;
                        break;
                    }
                }
                const endDate = p.date;
                let daysAtRate;
                if (nextChange && nextChange < endDate) {
                    daysAtRate = Math.min(remaining, (nextChange - cursor) / (1000 * 60 * 60 * 24));
                } else {
                    daysAtRate = remaining;
                }
                daysAtRate = Math.max(0, Math.floor(daysAtRate));
                amount *= Math.pow(1 + dailyRate, daysAtRate);
                remaining -= daysAtRate;
                if (nextChange && remaining > 0) {
                    cursor = new Date(nextChange);
                } else {
                    break;
                }
            }
            total += amount;
        }
        return { x: p.date, y: Math.round(total * 100) / 100 };
    });

    // ── Build Cash with inflation erosion ──
    // Shows the real purchasing power of cash over time
    const cashData = prices.map(p => {
        let total = 0;
        for (const tx of receives) {
            const txDate = new Date(tx.date);
            if (txDate > p.date) continue;

            // Calculate cumulative inflation from txDate to p.date
            let amount = tx.amountEur;
            const startYear = txDate.getFullYear();
            const endYear = p.date.getFullYear();

            if (startYear === endYear) {
                // Partial year
                const daysFraction = (p.date - txDate) / (1000 * 60 * 60 * 24 * 365);
                const rate = getInflationRate(txDate);
                amount /= (1 + rate * daysFraction);
            } else {
                // First partial year
                const endOfStartYear = new Date(startYear + 1, 0, 1);
                const fractionFirst = (endOfStartYear - txDate) / (1000 * 60 * 60 * 24 * 365);
                amount /= (1 + getInflationRate(txDate) * fractionFirst);

                // Full years in between
                for (let y = startYear + 1; y < endYear; y++) {
                    amount /= (1 + getInflationRate(new Date(y, 6, 1)));
                }

                // Last partial year
                const startOfEndYear = new Date(endYear, 0, 1);
                const fractionLast = (p.date - startOfEndYear) / (1000 * 60 * 60 * 24 * 365);
                amount /= (1 + getInflationRate(p.date) * fractionLast);
            }
            total += amount;
        }
        return { x: p.date, y: Math.round(total * 100) / 100 };
    });

    // ── Nominal cash line (total deposited) ──
    const nominalData = prices.map(p => {
        let total = 0;
        for (const tx of receives) {
            if (new Date(tx.date) <= p.date) total += tx.amountEur;
        }
        return { x: p.date, y: total };
    });

    // ── Gradients ──
    const orangeGrad = ctx.createLinearGradient(0, 0, 0, 380);
    orangeGrad.addColorStop(0, 'rgba(247, 147, 26, 0.20)');
    orangeGrad.addColorStop(1, 'rgba(247, 147, 26, 0.0)');

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Portefeuille Bitcoin (€)',
                    data: btcData,
                    borderColor: '#F7931A',
                    borderWidth: 2.5,
                    backgroundColor: orangeGrad,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#F7931A',
                    tension: 0.3,
                    order: 1
                },
                {
                    label: 'Livret A (€)',
                    data: livretData,
                    borderColor: '#4FC3F7',
                    borderWidth: 2,
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#4FC3F7',
                    tension: 0.3,
                    order: 2
                },
                {
                    label: 'Cash (pouvoir d\'achat réel) (€)',
                    data: cashData,
                    borderColor: '#FF6B6B',
                    borderWidth: 2,
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#FF6B6B',
                    tension: 0.3,
                    order: 3
                },
                {
                    label: 'Cash nominal (€)',
                    data: nominalData,
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    backgroundColor: 'transparent',
                    fill: false,
                    pointRadius: 0,
                    tension: 0,
                    order: 4
                }
            ]
        },
        options: chartOptions('€')
    });

    updateLegend([
        { color: '#F7931A', label: 'Bitcoin' },
        { color: '#4FC3F7', label: 'Livret A' },
        { color: '#FF6B6B', label: 'Cash réel (inflation)' },
        { color: 'rgba(255,255,255,0.25)', label: 'Cash nominal', dashed: true }
    ]);
}

function chartOptions(unit) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(17,17,24,0.95)',
                titleColor: '#e8e8ed',
                bodyColor: '#8a8a9a',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                cornerRadius: 10,
                padding: 14,
                titleFont: { family: 'Inter', size: 13, weight: 600 },
                bodyFont: { family: 'JetBrains Mono', size: 12 },
                callbacks: {
                    title: (items) => {
                        const d = new Date(items[0].parsed.x);
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                    },
                    label: (item) => {
                        return ' ' + item.dataset.label + ': ' + formatEur(item.parsed.y);
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'month',
                    displayFormats: { month: 'MMM yy' }
                },
                grid: {
                    color: 'rgba(255,255,255,0.03)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#55556a',
                    font: { family: 'Inter', size: 11 },
                    maxTicksLimit: 8
                }
            },
            y: {
                grid: {
                    color: 'rgba(255,255,255,0.04)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#55556a',
                    font: { family: 'JetBrains Mono', size: 11 },
                    callback: (v) => formatCompact(v),
                    maxTicksLimit: 6
                }
            }
        }
    };
}

function updateLegend(items) {
    const container = document.getElementById('chartLegend');
    container.innerHTML = items.map(item => {
        const style = item.dashed
            ? `border: 2px dashed ${item.color}; background: transparent;`
            : `background: ${item.color};`;
        const shape = item.shape === 'triangle'
            ? `width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:10px solid ${item.color};background:transparent;border-radius:0;`
            : style;
        return `<div class="legend-item"><span class="legend-dot" style="${shape}"></span>${item.label}</div>`;
    }).join('');
}

function updateChartDescription() {
    const desc = document.getElementById('chartDescText');

    // Compute live values for dynamic hero phrases
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedTx.forEach(tx => {
        if (!tx.btcQty) tx.btcQty = tx.amountEur / tx.priceBtc;
        if (!tx.type) tx.type = 'receive';
    });
    const receives = sortedTx.filter(tx => tx.type !== 'send');
    const sends = sortedTx.filter(tx => tx.type === 'send');
    const totalBtc = receives.reduce((s, tx) => s + tx.btcQty, 0) - sends.reduce((s, tx) => s + tx.btcQty, 0);
    const totalInvested = receives.reduce((s, tx) => s + tx.amountEur, 0);
    const totalWithdrawn = sends.reduce((s, tx) => s + tx.amountEur, 0);
    const netCost = totalInvested - totalWithdrawn;
    const currentValue = totalBtc * currentBtcPrice;
    const profitLoss = currentValue - netCost;
    const plSign = profitLoss >= 0 ? '+' : '';
    const plClass = profitLoss >= 0 ? 'hl-green' : 'hl-red';

    if (activeTab === 'portfolio') {
        desc.innerHTML = `Votre portefeuille <span class="hl-orange">Bitcoin</span> vaut aujourd'hui <span class="hl-orange">${formatEur(currentValue)}</span>, soit <span class="${plClass}">${plSign}${formatEur(profitLoss)}</span> par rapport à vos <span class="hl-dim">${formatEur(netCost)}</span> investis`;
    } else if (activeTab === 'impact') {
        desc.innerHTML = `Si le prix du <span class="hl-orange">Bitcoin</span> bouge, vos <span class="hl-orange">${totalBtc.toFixed(6)} BTC</span> changent de valeur — même sans rien faire`;
    } else if (activeTab === 'compare') {
        desc.innerHTML = `Avec les mêmes <span class="hl-dim">${formatEur(netCost)}</span> investis : <span class="hl-orange">Bitcoin</span> vs <span class="hl-blue">Livret A</span> vs <span class="hl-red">garder du cash</span> (érodé par l'inflation)`;
    }
}

// ══════════════════════════════════════
//   TRANSACTION TABLE
// ══════════════════════════════════════
function renderTransactionTable(sortedTx) {
    const tbody = document.getElementById('txTableBody');
    const receives = sortedTx.filter(tx => tx.type !== 'send');
    const totalInvested = receives.reduce((s, tx) => s + tx.amountEur, 0);
    document.getElementById('historyTotal').textContent = formatEur(totalInvested);

    tbody.innerHTML = sortedTx.map((tx, i) => {
        const isReceive = tx.type !== 'send';
        const currentVal = tx.btcQty * currentBtcPrice;
        const gain = isReceive ? (currentVal - tx.amountEur) : 0;
        const gainPct = isReceive && tx.amountEur > 0 ? ((currentVal / tx.amountEur) - 1) * 100 : 0;
        const cls = isReceive ? (gain >= 0 ? 'tx-gain' : 'tx-loss') : 'tx-dim';
        const arrow = isReceive ? (gain >= 0 ? '▲' : '▼') : '—';

        const typeLabel = isReceive ? 'Réception' : 'Envoi';
        const typeCls = isReceive ? 'buy' : 'sell';

        const dateStr = new Date(tx.date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        const gainStr = isReceive
            ? `${arrow} ${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`
            : '—';

        return `<tr>
            <td class="tx-date">${dateStr}</td>
            <td><span class="tx-type ${typeCls}">${typeLabel}</span></td>
            <td>${formatEur(tx.amountEur)}</td>
            <td>${formatEur(tx.priceBtc)}</td>
            <td>${isReceive ? '' : '-'}${tx.btcQty.toFixed(8)}</td>
            <td>${isReceive ? formatEur(currentVal) : '—'}</td>
            <td class="${cls}">${gainStr}</td>
        </tr>`;
    }).join('');
}

// ══════════════════════════════════════
//   CONFIG MODAL
// ══════════════════════════════════════
function showConfig() {
    const overlay = document.getElementById('configOverlay');
    overlay.classList.remove('hidden');
    const container = document.getElementById('txRows');
    container.innerHTML = '';

    if (transactions.length > 0) {
        transactions.forEach(tx => addTxRow(tx));
    } else {
        addTxRow();
    }
}

function addTxRow(tx = null) {
    const container = document.getElementById('txRows');
    const row = document.createElement('div');
    row.className = 'tx-row';
    row.innerHTML = `
        <div class="field">
            <label>Date</label>
            <input type="date" class="tx-date-input" value="${tx ? tx.date : ''}">
        </div>
        <div class="field">
            <label>Montant (€)</label>
            <input type="number" class="tx-amount-input" placeholder="200" value="${tx ? tx.amountEur : ''}" step="any">
        </div>
        <div class="field">
            <label>Prix BTC (€)</label>
            <input type="number" class="tx-price-input" placeholder="45000" value="${tx ? tx.priceBtc : ''}" step="any">
        </div>
        <button class="btn-remove" title="Supprimer">✕</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function loadDemo() {
    const container = document.getElementById('txRows');
    container.innerHTML = '';
    DEMO_TRANSACTIONS.forEach(tx => addTxRow(tx));
}

function saveConfig() {
    const rows = document.querySelectorAll('#txRows .tx-row');
    const newTx = [];
    let valid = true;

    rows.forEach(row => {
        const date = row.querySelector('.tx-date-input').value;
        const amount = parseFloat(row.querySelector('.tx-amount-input').value);
        const price = parseFloat(row.querySelector('.tx-price-input').value);

        if (!date || isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) {
            valid = false;
            return;
        }
        newTx.push({ date, amountEur: amount, priceBtc: price });
    });

    if (!valid || newTx.length === 0) {
        alert('Veuillez remplir correctement toutes les transactions (date, montant > 0, prix > 0).');
        return;
    }

    transactions = newTx;
    walletMode = 'manual';
    walletAddress = null;
    localStorage.setItem('btc_transactions', JSON.stringify(transactions));
    localStorage.removeItem('btc_address');
    document.getElementById('configOverlay').classList.add('hidden');

    // Reset footer
    document.querySelector('.footer p').innerHTML =
        'Les données affichées sont basées sur vos saisies manuelles. <span class="accent">₿</span> Bitcoin Wallet Viewer';

    boot();
}

// ══════════════════════════════════════
//   HELPERS
// ══════════════════════════════════════
function formatEur(n) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(n);
}

function formatCompact(n) {
    if (n >= 1000) {
        return new Intl.NumberFormat('fr-FR', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1
        }).format(n) + ' €';
    }
    return formatEur(n);
}

function findClosestPrice(targetDate, prices) {
    let closest = null;
    let minDiff = Infinity;
    for (const p of prices) {
        const diff = Math.abs(p.date - targetDate);
        if (diff < minDiff) {
            minDiff = diff;
            closest = p;
        }
    }
    return closest;
}
