const API_BASE = 'https://akm-ads-bot.onrender.com';
let currentUser = null;

async function loadUser() {
    const stored = localStorage.getItem('akm_user');
    if (!stored && !window.location.pathname.includes('index.html')) { window.location.href = '/'; return; }
    if (stored) {
        currentUser = JSON.parse(stored);
        if (document.getElementById('balance')) document.getElementById('balance').innerText = `$${(currentUser.balance || 0).toFixed(2)}`;
        if (document.getElementById('balanceAmount')) document.getElementById('balanceAmount').innerText = `$${(currentUser.balance || 0).toFixed(2)}`;
        if (document.getElementById('userInfo')) document.getElementById('userInfo').innerHTML = `<div>${currentUser.username || 'User'}</div><div style="font-size:12px;color:#888">${currentUser.user_type}</div>`;
    }
    return currentUser;
}

async function loadDashboard() {
    await loadUser();
    if (!currentUser) return;
    const statsDiv = document.getElementById('statsGrid');
    if (!statsDiv) return;
    try {
        if (currentUser.user_type === 'advertiser') {
            const campaigns = await (await fetch(`${API_BASE}/api/campaigns/advertiser/${currentUser.id}`)).json();
            const orders = await (await fetch(`${API_BASE}/api/orders/${currentUser.id}`)).json();
            const totalSpent = (campaigns || []).reduce((s, c) => s + (c.budget || 0), 0);
            statsDiv.innerHTML = `<div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value">$${(currentUser.balance || 0).toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">Active Campaigns</div><div class="stat-value">${campaigns.filter(c => c.is_active).length}</div></div>
                <div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-value">$${totalSpent.toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">Pending Orders</div><div class="stat-value">${orders.filter(o => o.status === 'pending').length}</div></div>`;
        } else {
            const channels = await (await fetch(`${API_BASE}/api/channels/owner/${currentUser.id}`)).json();
            const orders = await (await fetch(`${API_BASE}/api/orders/${currentUser.id}`)).json();
            const potential = (channels || []).reduce((s, c) => s + (c.price_per_post || 0), 0);
            statsDiv.innerHTML = `<div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value">$${(currentUser.balance || 0).toFixed(2)}</div></div>
                <div class="stat-card"><div class="stat-label">Your Channels</div><div class="stat-value">${channels.length}</div></div>
                <div class="stat-card"><div class="stat-label">Completed Orders</div><div class="stat-value">${orders.filter(o => o.status === 'released').length}</div></div>
                <div class="stat-card"><div class="stat-label">Potential Earnings</div><div class="stat-value">$${potential.toFixed(2)}</div></div>`;
        }
    } catch(e) { console.error(e); }
    const activityDiv = document.getElementById('activityList');
    if (activityDiv) {
        try {
            const orders = await (await fetch(`${API_BASE}/api/orders/${currentUser.id}`)).json();
            if (orders && orders.length > 0) {
                activityDiv.innerHTML = orders.slice(0,5).map(o => `<div class="activity-item">Order #${o.id} - $${(o.amount || 0).toFixed(2)} - ${(o.status || 'pending').toUpperCase()}</div>`).join('');
            } else { activityDiv.innerHTML = '<div class="activity-item">No recent activity</div>'; }
        } catch(e) {}
    }
}

async function loadMarketplace() {
    await loadUser();
    const grid = document.getElementById('channelsGrid');
    if (!grid) return;
    try {
        const channels = await (await fetch(`${API_BASE}/api/channels`)).json();
        if (!channels || channels.length === 0) { grid.innerHTML = '<div class="channel-card">No channels available</div>'; return; }
        grid.innerHTML = channels.map(c => `<div class="channel-card"><div class="channel-header"><strong>${c.title}</strong><span class="channel-category">${c.category}</span></div>
            <div>Subscribers: ${(c.subscribers || 0).toLocaleString()}</div><div class="channel-price">$${(c.price_per_post || 0).toFixed(2)}</div>
            ${currentUser?.user_type === 'advertiser' ? `<button class="btn" onclick="bookChannel(${c.id}, ${c.price_per_post})">Book Ad</button>` : ''}</div>`).join('');
    } catch(e) { grid.innerHTML = '<div class="channel-card">Error loading channels</div>'; }
}

async function loadCampaigns() {
    await loadUser();
    const container = document.getElementById('campaignsList');
    if (!container) return;
    if (currentUser?.user_type !== 'advertiser') { container.innerHTML = '<div class="campaign-card">Advertisers only</div>'; return; }
    try {
        const campaigns = await (await fetch(`${API_BASE}/api/campaigns/advertiser/${currentUser.id}`)).json();
        if (!campaigns || campaigns.length === 0) { container.innerHTML = '<div class="campaign-card">No campaigns yet</div>'; return; }
        let html = '';
        for (const c of campaigns) {
            const orders = await (await fetch(`${API_BASE}/api/orders/campaign/${c.id}`)).json();
            const completed = (orders || []).filter(o => o.status === 'released').length;
            const progress = orders.length ? (completed / orders.length) * 100 : 0;
            html += `<div class="campaign-card"><strong>${c.title}</strong> - $${c.budget}<br>Progress: ${Math.round(progress)}% (${completed}/${orders.length})<br><button class="btn-secondary" onclick="viewOrders(${c.id})">View Orders</button></div>`;
        }
        container.innerHTML = html;
    } catch(e) { console.error(e); }
}

async function loadWallet() {
    await loadUser();
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    try {
        const orders = await (await fetch(`${API_BASE}/api/orders/${currentUser.id}`)).json();
        const active = (orders || []).filter(o => o.status !== 'released');
        if (active.length === 0) { ordersList.innerHTML = '<div class="order-card">No active orders</div>'; return; }
        ordersList.innerHTML = active.map(o => `<div class="order-card"><strong>Order #${o.id}</strong> - $${(o.amount || 0).toFixed(2)}<br>Status: ${o.status}<br>
            ${o.status === 'pending' ? `<button class="btn-secondary" onclick="lockPayment(${o.id})">Lock Payment</button>` : ''}
            ${o.status === 'locked' ? `<button class="btn-secondary" onclick="releasePayment(${o.id})">Confirm & Release</button>` : ''}</div>`).join('');
    } catch(e) { console.error(e); }
}

async function bookChannel(id, price) {
    if (confirm(`Book this channel for $${price}?`)) {
        await fetch(`${API_BASE}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advertiser_id: currentUser.id, title: 'Direct Booking', description: '', category: 'General', budget: price, price_per_post: price, target_subscribers_min: 0 }) });
        alert('Booking created! Check your campaigns.'); window.location.href = 'campaigns.html';
    }
}

async function lockPayment(id) {
    try { await fetch(`${API_BASE}/api/orders/${id}/lock`, { method: 'POST' }); alert('Payment locked in escrow!'); loadWallet(); loadDashboard(); } 
    catch(e) { alert('Insufficient balance. Add funds first.'); }
}

async function releasePayment(id) {
    await fetch(`${API_BASE}/api/orders/${id}/confirm-post`, { method: 'POST' });
    await fetch(`${API_BASE}/api/orders/${id}/release`, { method: 'POST' });
    alert('Payment released to publisher!'); loadWallet(); loadDashboard();
}

async function addFunds() {
    const amount = prompt('Amount ($10-1000):', '100');
    if (amount && amount >= 10 && amount <= 1000) {
        const res = await fetch(`${API_BASE}/api/users/${currentUser.telegram_id}/add-funds?amount=${amount}`, { method: 'POST' });
        const data = await res.json();
        currentUser.balance = data.new_balance;
        localStorage.setItem('akm_user', JSON.stringify(currentUser));
        if (document.getElementById('balance')) document.getElementById('balance').innerText = `$${currentUser.balance.toFixed(2)}`;
        if (document.getElementById('balanceAmount')) document.getElementById('balanceAmount').innerText = `$${currentUser.balance.toFixed(2)}`;
        alert(`Added $${amount}`); if (window.loadDashboard) loadDashboard(); if (window.loadWallet) loadWallet();
    }
}

function showCreateModal() { document.getElementById('campaignModal')?.classList.add('active'); }
function closeModal() { document.getElementById('campaignModal')?.classList.remove('active'); }

async function createCampaign() {
    const data = { advertiser_id: currentUser.id, title: document.getElementById('campaignTitle').value, description: document.getElementById('campaignDesc').value, category: document.getElementById('campaignCategory').value, budget: parseFloat(document.getElementById('campaignBudget').value), price_per_post: parseFloat(document.getElementById('campaignPrice').value), target_subscribers_min: 0 };
    if (data.budget < 50) { alert('Minimum budget $50'); return; }
    if (data.price_per_post > data.budget) { alert('Price per post cannot exceed budget'); return; }
    await fetch(`${API_BASE}/api/campaigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    alert('Campaign created! Auto-matching channels...'); closeModal(); loadCampaigns();
}

async function viewOrders(cid) {
    const orders = await (await fetch(`${API_BASE}/api/orders/campaign/${cid}`)).json();
    alert(orders.map(o => `#${o.id}: $${o.amount} - ${o.status}`).join('\n'));
}

window.selectRole = async function(role) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'flex';
    let userId = null;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    else userId = prompt('Enter Telegram ID (demo):', '123456789');
    if (!userId) { if (loading) loading.style.display = 'none'; return; }
    try {
        const res = await fetch(`${API_BASE}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telegram_id: parseInt(userId), username: 'user', user_type: role }) });
        const user = await res.json();
        localStorage.setItem('akm_user', JSON.stringify(user));
        window.location.href = 'dashboard.html';
    } catch(e) { alert('Connection error'); if (loading) loading.style.display = 'none'; }
};

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('dashboard')) loadDashboard();
    else if (path.includes('marketplace')) loadMarketplace();
    else if (path.includes('campaigns')) { loadCampaigns(); document.getElementById('createCampaignBtn')?.addEventListener('click', showCreateModal); document.getElementById('submitCampaign')?.addEventListener('click', createCampaign); document.getElementById('cancelModal')?.addEventListener('click', closeModal); }
    else if (path.includes('wallet')) { loadWallet(); document.getElementById('addFundsBtn')?.addEventListener('click', addFunds); }
});