let config = {};
let currentPool = null;
let refreshTimer = 0;
let refreshIntervalMs = 30000;

function formatHashrate(hashrate) {
    let hr = Number(hashrate);
    if (!hr || isNaN(hr)) return "0.00 H/s";
    let i = 0;
    const byteUnits = [' H/s', ' KH/s', ' MH/s', ' GH/s', ' TH/s', ' PH/s'];
    while (hr >= 1000 && i < byteUnits.length - 1) {
        hr /= 1000;
        i++;
    }
    return hr.toFixed(2) + byteUnits[i];
}

function formatDifficulty(difficulty) {
    let diff = Number(difficulty);
    if (!diff || isNaN(diff)) return "0";
    let i = 0;
    const units = ['', ' K', ' M', ' G', ' T', ' P', ' E'];
    while (diff >= 1000 && i < units.length - 1) {
        diff /= 1000;
        i++;
    }
    return diff.toFixed(2) + units[i];
}

function formatDate(dateString) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
}

function getStatusBadge(status) {
    if(!status) return "";
    if(status.toLowerCase() === 'confirmed') return `<span class="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold">Confirmed</span>`;
    if(status.toLowerCase() === 'pending') return `<span class="px-2 py-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold">Pending</span>`;
    return `<span class="px-2 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-semibold">${status}</span>`;
}

function navigate(section) {
    refreshTimer = 0;
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden');
    });
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
    });
    
    document.getElementById(`sec-${section}`).classList.remove('hidden');
    
    const navItems = Array.from(document.querySelectorAll('.nav-item'));
    const activeNav = navItems.find(el => el.textContent.toLowerCase().includes(section) || (section === 'poolinfo' && el.textContent === 'Connect'));
    if(activeNav) activeNav.classList.add('active');

    refreshActiveData();
}

function refreshActiveData() {
    if (!currentPool) return;
    if (!document.getElementById('sec-home').classList.contains('hidden')) loadDashboard();
    if (!document.getElementById('sec-blocks').classList.contains('hidden')) loadBlocks();
    if (!document.getElementById('sec-miners').classList.contains('hidden')) loadMiners();
    if (!document.getElementById('sec-payments').classList.contains('hidden')) loadPayments();
    if (!document.getElementById('sec-poolinfo').classList.contains('hidden')) loadPoolInfo();
    if (!document.getElementById('sec-minerinfo').classList.contains('hidden')) {
        const addr = document.getElementById('walletInput').value.trim();
        if(addr) searchWallet(true);
    }
}

function startAutoRefresh() {
    refreshIntervalMs = config.refreshInterval || 30000;
    setInterval(() => {
        refreshTimer += 100;
        const percentage = (refreshTimer / refreshIntervalMs) * 100;
        const bar = document.getElementById('refreshBar');
        if(bar) bar.style.width = `${percentage}%`;

        if (refreshTimer >= refreshIntervalMs) {
            refreshTimer = 0;
            refreshActiveData();
        }
    }, 100);
}

async function fetchApi(endpoint) {
    try {
        const res = await fetch(`${config.miningcoreApiUrl}${endpoint}`);
        if (!res.ok) throw new Error('API request failed');
        return await res.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function init() {
    const res = await fetch('/config');
    const rawConfig = await res.json();
    
    const host = window.location.hostname;
    const isLocal = host === '127.0.0.1' || 
                    host.startsWith('192.168.') || 
                    host.startsWith('10.') || 
                    host.endsWith('.lan');

    config = {
        ...rawConfig,
        miningcoreApiUrl: isLocal ? rawConfig.apiBaseUrlLocal : rawConfig.apiBaseUrlRemote
    };

    const pools = await fetchApi('/api/pools');
    if (pools && pools.pools.length > 0) {
        currentPool = config.defaultPoolId ? pools.pools.find(p => p.id === config.defaultPoolId) : pools.pools[0];
        if (!currentPool) currentPool = pools.pools[0];
        
        document.getElementById('poolName').innerHTML = `${currentPool.coin.name}<span class="text-indigo-400">Pool</span>`;
        navigate('home');
        startAutoRefresh();
    }
}

async function loadDashboard() {
    if (!currentPool) return;
    const pool = await fetchApi(`/api/pools/${currentPool.id}`);
    if (pool) {
        document.getElementById('poolHashrate').textContent = formatHashrate(pool.pool.poolStats.poolHashrate);
        document.getElementById('netHashrate').textContent = formatHashrate(pool.pool.networkStats.networkHashrate);
        document.getElementById('netDiff').textContent = formatDifficulty(pool.pool.networkStats.networkDifficulty);
        document.getElementById('blockHeight').textContent = pool.pool.networkStats.blockHeight.toLocaleString();
        document.getElementById('connectedMiners').textContent = pool.pool.poolStats.connectedMiners.toLocaleString();
        
        const totalBlocks = pool.pool.totalBlocks || 0;
        const totalPendingBlocks = pool.pool.totalPendingBlocks || 0;
        const effort = pool.pool.poolEffort || 0;
        const blockReward = pool.pool.blockReward || 0; 
        
        document.getElementById('poolBlocks').textContent = totalBlocks;
        
        const badge = document.getElementById('pendingBlocksBadge');
        if (totalPendingBlocks > 0) {
            badge.textContent = `${totalPendingBlocks} Pending`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        document.getElementById('poolEffort').textContent = (effort * 100).toFixed(2) + '%';
        document.getElementById('networkBlockReward').textContent = blockReward > 0 ? `${blockReward} ${currentPool.coin.type}` : "0";
    }

    const blocksHistoryResponse = await fetchApi(`/api/pools/${currentPool.id}/blocks?page=0&pageSize=100`);
    
    const historyData = [];
    for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const yyyyMmDd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        historyData.push({
            dateStr: yyyyMmDd,
            displayLabel: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
            count: 0
        });
    }

    if (blocksHistoryResponse && blocksHistoryResponse.length > 0) {
        blocksHistoryResponse.forEach(b => {
            const bDate = new Date(b.created);
            const yyyyMmDd = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, '0')}-${String(bDate.getDate()).padStart(2, '0')}`;
            
            const target = historyData.find(h => h.dateStr === yyyyMmDd);
            if (target) {
                target.count++;
            }
        });
    }

    const container = document.getElementById('blocks7DaysContainer');
    container.innerHTML = '';
    historyData.forEach(day => {
        container.innerHTML += `
            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center text-center transition-colors hover:bg-slate-700/50">
                <span class="text-xs text-slate-400 font-medium mb-1">${day.displayLabel}</span>
                <span class="text-2xl font-bold ${day.count > 0 ? 'text-emerald-400' : 'text-slate-600'}">${day.count}</span>
            </div>
        `;
    });
}

async function loadBlocks() {
    const blocks = await fetchApi(`/api/pools/${currentPool.id}/blocks?page=0&pageSize=20`);
    const tbody = document.getElementById('blocksTableBody');
    tbody.innerHTML = '';
    if (blocks && blocks.length > 0) {
        blocks.forEach(b => {
            const explorerUrl = b.infoLink || '#';
            tbody.innerHTML += `
                <tr class="hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 font-medium text-slate-200">
                        ${explorerUrl !== '#' ? `<a href="${explorerUrl}" target="_blank" class="hover:text-indigo-400 hover:underline">${b.blockHeight}</a>` : b.blockHeight}
                    </td>
                    <td class="px-6 py-4 text-xs font-mono text-indigo-400 cursor-pointer hover:underline" onclick="viewMiner('${b.miner}')">${b.miner}</td>
                    <td class="px-6 py-4 text-slate-400">${formatDate(b.created)}</td>
                    <td class="px-6 py-4 font-medium text-indigo-400">${b.reward}</td>
                    <td class="px-6 py-4">${getStatusBadge(b.status)}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No blocks found yet.</td></tr>`;
    }
}

async function loadMiners() {
    const miners = await fetchApi(`/api/pools/${currentPool.id}/miners?page=0&pageSize=20`);
    const tbody = document.getElementById('minersTableBody');
    tbody.innerHTML = '';
    if (miners && miners.length > 0) {
        miners.forEach(m => {
            tbody.innerHTML += `
                <tr class="hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 text-sm font-mono text-indigo-400 cursor-pointer hover:underline" onclick="viewMiner('${m.miner}')">${m.miner}</td>
                    <td class="px-6 py-4 font-medium text-slate-200">${formatHashrate(m.hashrate)}</td>
                    <td class="px-6 py-4 text-slate-400">${m.sharesPerSecond.toFixed(2)}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-500">No active miners.</td></tr>`;
    }
}

async function loadPayments() {
    const payments = await fetchApi(`/api/pools/${currentPool.id}/payments?page=0&pageSize=20`);
    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '';
    if (payments && payments.length > 0) {
        payments.forEach(p => {
            const explorerUrl = p.transactionInfoLink || '#';
            tbody.innerHTML += `
                <tr class="hover:bg-slate-700/50 transition-colors">
                    <td class="px-6 py-4 text-slate-400">${formatDate(p.created)}</td>
                    <td class="px-6 py-4 text-xs font-mono text-indigo-400 cursor-pointer hover:underline" onclick="viewMiner('${p.address}')">${p.address}</td>
                    <td class="px-6 py-4 font-medium text-emerald-400">${p.amount}</td>
                    <td class="px-6 py-4">
                        ${explorerUrl !== '#' ? `<a href="${explorerUrl}" target="_blank" class="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition">View Tx ↗</a>` : `<span class="text-slate-500 text-sm">No Link</span>`}
                    </td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No payments found.</td></tr>`;
    }
}

async function loadPoolInfo() {
    const coin = currentPool.coin.type;
    const fee = currentPool.poolFeePercent;
    const minPayout = currentPool.paymentProcessing.minimumPayment;
    const explorerPoolWalletUrl = currentPool.addressInfoLink || '#';
    const poolAddress = currentPool.address || 'Unknown Address';

    let miningcoreHost = window.location.hostname;
    try {
        if (config.miningcoreApiUrl && config.miningcoreApiUrl.startsWith('http')) {
            const url = new URL(config.miningcoreApiUrl);
            miningcoreHost = url.hostname;
        }
    } catch (e) {
        console.error("Failed to parse miningcoreApiUrl");
    }

    const stratumPorts = Object.keys(currentPool.ports).map(port => `${miningcoreHost}:${port}`).join(', ');

    document.getElementById('infoCoin').textContent = coin;
    document.getElementById('infoFee').textContent = `${fee}%`;
    document.getElementById('infoMinPayout').textContent = minPayout;
    document.getElementById('infoStratum').textContent = `stratum+tcp://${stratumPorts}`;
    
    const explorerEl = document.getElementById('infoExplorer');
    if (explorerPoolWalletUrl !== '#') {
        explorerEl.href = explorerPoolWalletUrl;
        explorerEl.textContent = `${poolAddress} ↗`;
        explorerEl.classList.remove('hidden');
    } else {
        explorerEl.classList.add('hidden');
    }
}

function viewMiner(address) {
    document.getElementById('walletInput').value = address;
    searchWallet();
}

async function searchWallet(isRefresh = false) {
    if(!isRefresh) refreshTimer = 0;
    const address = document.getElementById('walletInput').value.trim();
    if (!address) return;

    if(!isRefresh) {
        navigate('minerinfo');
        document.getElementById('minerAddressLabel').textContent = address;
    }
    
    const info = await fetchApi(`/api/pools/${currentPool.id}/miners/${address}`);
    const tbody = document.getElementById('workersTableBody');
    tbody.innerHTML = '';

    if (info) {
        document.getElementById('minerPending').textContent = Number(info.pendingBalance || 0).toFixed(6);
        document.getElementById('minerPaid').textContent = Number(info.totalPaid || 0).toFixed(6);
        
        let totalHashrate = 0;
        if (info.performance) {
            totalHashrate = Number(info.performance.hashrate) || 0;
            if (totalHashrate === 0 && info.performance.workers) {
                Object.values(info.performance.workers).forEach(worker => {
                    totalHashrate += Number(worker.hashrate) || 0;
                });
            }
        }
        
        document.getElementById('minerHashrate').textContent = formatHashrate(totalHashrate);

        if (info.performance && info.performance.workers && Object.keys(info.performance.workers).length > 0) {
            for (const [name, stats] of Object.entries(info.performance.workers)) {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-700/50 transition-colors">
                        <td class="px-6 py-4 font-medium text-slate-200">${name}</td>
                        <td class="px-6 py-4 text-slate-300">${formatHashrate(stats.hashrate)}</td>
                        <td class="px-6 py-4 text-slate-400">${Number(stats.sharesPerSecond || 0).toFixed(2)}</td>
                    </tr>
                `;
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-slate-500">No active workers for this address.</td></tr>';
        }
    } else {
        document.getElementById('minerPending').textContent = "0.000000";
        document.getElementById('minerPaid').textContent = "0.000000";
        document.getElementById('minerHashrate').textContent = "0.00 H/s";
        tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-rose-500 font-medium">Miner not found or has no active data.</td></tr>';
    }
}

init();