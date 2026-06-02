// ============ API CONFIGURATION ============
const API_BASE = 'https://akm-ads-bot.onrender.com';
let currentUser = null;
let allChannels = [];

// ============ MOBILE MENU FUNCTIONS ============
function initMobileMenu() {
    const menuBtn = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!menuBtn) return;

    function openMenu() {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        menuBtn.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        menuBtn.classList.remove('active');
        document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('active')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    overlay.addEventListener('click', closeMenu);
}

// ============ USER MANAGEMENT ============
async function loadUser() {
    const stored = localStorage.getItem('akm_user');
    if (!stored && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
        return null;
    }
    if (stored) {
        currentUser = JSON.parse(stored);
        const userInfoElements = document.querySelectorAll('#userInfo');
        userInfoElements.forEach(el => {
            if (el) el.innerHTML = `${currentUser.username || 'User'}<br><small>${currentUser.user_type || ''}</small>`;
        });
        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(el => {
            if (el) el.innerText = currentUser.username || 'User';
        });
    }
    return currentUser;
}

window.selectRole = async function(role) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'flex';
    
    let userId = null;
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        userId = window.Telegram.WebApp.initDataUnsafe.user.id;
    } else {
        userId = prompt('Enter Telegram ID (demo):', '123456789');
    }
    if (!userId) {
        if (loading) loading.style.display = 'none';
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: parseInt(userId), username: 'user', user_type: role })
        });
        const user = await res.json();
        localStorage.setItem('akm_user', JSON.stringify(user));
        window.location.href = 'dashboard.html';
    } catch(e) {
        alert('Connection error: ' + e.message);
        if (loading) loading.style.display = 'none';
    }
};

// ============ HELPER FUNCTIONS ============
async function getUserOrders(userId, userType) {
    try {
        if (userType === 'advertiser') {
            const campaigns = await (await fetch(`${API_BASE}/api/campaigns/advertiser/${userId}`)).json();
            let allOrders = [];
            if (campaigns && campaigns.length > 0) {
                for (const campaign of campaigns) {
                    const orders = await (await fetch(`${API_BASE}/api/orders/campaign/${campaign.id}`)).json();
                    if (orders && orders.length > 0) {
                        allOrders = [...allOrders, ...orders];
                    }
                }
            }
            return allOrders;
        } else {
            const channels = await (await fetch(`${API_BASE}/api/channels/owner/${userId}`)).json();
            let allOrders = [];
            if (channels && channels.length > 0) {
                for (const channel of channels) {
                    const orders = await (await fetch(`${API_BASE}/api/orders/channel/${channel.id}`)).json();
                    if (orders && orders.length > 0) {
                        allOrders = [...allOrders, ...orders];
                    }
                }
            }
            return allOrders;
        }
    } catch(e) {
        console.error('Error getting orders:', e);
        return [];
    }
}

// ============ DASHBOARD ============
async function loadDashboard() {
    await loadUser();
    if (!currentUser) return;
    
    try {
        if (currentUser.user_type === 'advertiser') {
            const campaigns = await (await fetch(`${API_BASE}/api/campaigns/advertiser/${currentUser.id}`)).json();
            const orders = await getUserOrders(currentUser.id, 'advertiser');
            const totalSpent = (campaigns || []).reduce((s, c) => s + (c.budget || 0), 0);
            
            document.getElementById('balanceVal').innerText = `$${(currentUser.balance || 0).toFixed(2)}`;
            document.getElementById('campaignsVal').innerText = (campaigns || []).filter(c => c.is_active).length;
            document.getElementById('spentVal').innerText = `$${totalSpent.toFixed(2)}`;
            document.getElementById('pendingVal').innerText = (orders || []).filter(o => o.status === 'pending').length;
            
            const activityList = document.getElementById('activityList');
            if (orders && orders.length > 0) {
                activityList.innerHTML = orders.slice(0,5).map(o => 
                    `<div class="activity-item">Order #${o.id} - $${(o.amount || 0).toFixed(2)} - ${(o.status || 'pending').toUpperCase()}</div>`
                ).join('');
            } else {
                activityList.innerHTML = '<div class="activity-item">No recent activity</div>';
            }
        } else {
            const channels = await (await fetch(`${API_BASE}/api/channels/owner/${currentUser.id}`)).json();
            const orders = await getUserOrders(currentUser.id, 'channel_owner');
            
            document.getElementById('balanceVal').innerText = `$${(currentUser.balance || 0).toFixed(2)}`;
            document.getElementById('campaignsVal').innerText = (channels || []).length;
            document.getElementById('spentVal').innerText = `$${(channels || []).reduce((s, c) => s + (c.price_per_post || 0), 0).toFixed(2)}`;
            document.getElementById('pendingVal').innerText = (orders || []).filter(o => o.status === 'pending').length;
            document.getElementById('activityList').innerHTML = '<div class="activity-item">Add channels to start earning</div>';
        }
    } catch(e) {
        console.error('Dashboard error:', e);
        const activityList = document.getElementById('activityList');
        if (activityList) activityList.innerHTML = '<div class="activity-item">Backend connection error</div>';
    }
}

// ============ MARKETPLACE ============
async function loadMarketplace() {
    await loadUser();
    const grid = document.getElementById('channelsGrid');
    if (!grid) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/channels`);
        allChannels = await res.json();
        displayChannels(allChannels);
    } catch(e) {
        grid.innerHTML = '<div class="loading">Error loading channels</div>';
    }
}

function displayChannels(channels) {
    const grid = document.getElementById('channelsGrid');
    if (!channels || channels.length === 0) {
        grid.innerHTML = '<div class="loading">No channels available</div>';
        return;
    }
    grid.innerHTML = channels.map(c => `
        <div class="channel-card">
            <div class="channel-header">
                <strong>${escapeHtml(c.title)}</strong>
                <span class="channel-category">${c.category}</span>
            </div>
            <div>Subscribers: ${formatNumber(c.subscribers || 0)}</div>
            <div class="channel-price">$${(c.price_per_post || 0).toFixed(2)} per post</div>
            ${currentUser?.user_type === 'advertiser' ? `<button class="btn-primary" style="width:100%;margin-top:12px" onclick="bookChannel(${c.id}, ${c.price_per_post})">Book Advertisement</button>` : ''}
        </div>
    `).join('');
}

function filterChannels() {
    const category = document.getElementById('categoryFilter')?.value;
    if (!category || category === '') {
        displayChannels(allChannels);
    } else {
        const filtered = allChannels.filter(c => c.category === category);
        displayChannels(filtered);
    }
}

async function bookChannel(id, price) {
    if (!currentUser) return;
    if (confirm(`Book this channel for $${price}?`)) {
        try {
            await fetch(`${API_BASE}/api/campaigns`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    advertiser_id: currentUser.id, 
                    title: 'Direct Booking', 
                    description: 'Auto-created from marketplace', 
                    category: 'General', 
                    budget: price, 
                    price_per_post: price, 
                    target_subscribers_min: 0 
                }) 
            });
            alert('Campaign created successfully'); 
            window.location.href = 'campaigns.html';
        } catch(e) { 
            alert('Error: ' + e.message); 
        }
    }
}

// ============ CAMPAIGNS ============
async function loadCampaigns() {
    await loadUser();
    const container = document.getElementById('campaignsList');
    if (!container) return;
    
    if (currentUser?.user_type !== 'advertiser') { 
        container.innerHTML = '<div class="loading">Only advertisers can create campaigns</div>'; 
        return; 
    }
    
    try {
        const campaigns = await (await fetch(`${API_BASE}/api/campaigns/advertiser/${currentUser.id}`)).json();
        if (!campaigns || campaigns.length === 0) { 
            container.innerHTML = '<div class="loading">No campaigns yet. Click Create Campaign to start</div>'; 
            return; 
        }
        
        let html = '';
        for (const c of campaigns) {
            const orders = await (await fetch(`${API_BASE}/api/orders/campaign/${c.id}`)).json();
            const completed = (orders || []).filter(o => o.status === 'released').length;
            const progress = orders.length ? Math.round((completed / orders.length) * 100) : 0;
            html += `
                <div class="campaign-card">
                    <strong>${escapeHtml(c.title)}</strong>
                    <p style="color:#6b7280; margin:8px 0">${escapeHtml(c.description?.substring(0, 100))}...</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 12px;">
                        <span>Budget: $${c.budget}</span>
                        <span>Progress: ${progress}%</span>
                    </div>
                    <button class="btn-secondary" style="margin-top:12px" onclick="viewCampaignOrders(${c.id})">View Orders</button>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch(e) { 
        console.error(e);
        container.innerHTML = '<div class="loading">Error loading campaigns</div>';
    }
}

async function viewCampaignOrders(campaignId) {
    try {
        const orders = await (await fetch(`${API_BASE}/api/orders/campaign/${campaignId}`)).json();
        if (!orders || orders.length === 0) {
            alert('No orders for this campaign');
            return;
        }
        alert(orders.map(o => `Order #${o.id}: $${o.amount} - ${o.status.toUpperCase()}`).join('\n'));
    } catch(e) {
        alert('Error loading orders');
    }
}

function showCreateModal() { 
    document.getElementById('campaignModal')?.classList.add('active'); 
}

function closeModal() { 
    document.getElementById('campaignModal')?.classList.remove('active'); 
}

async function createCampaign() {
    const data = { 
        advertiser_id: currentUser.id, 
        title: document.getElementById('campaignTitle')?.value, 
        description: document.getElementById('campaignDesc')?.value, 
        category: document.getElementById('campaignCategory')?.value, 
        budget: parseFloat(document.getElementById('campaignBudget')?.value), 
        price_per_post: parseFloat(document.getElementById('campaignPrice')?.value), 
        target_subscribers_min: parseInt(document.getElementById('campaignMinSubs')?.value || 0)
    };
    
    if (!data.title) { alert('Please enter a campaign title'); return; }
    if (data.budget < 50) { alert('Minimum budget is $50'); return; }
    if (data.price_per_post > data.budget) { alert('Price per post cannot exceed total budget'); return; }
    
    try {
        await fetch(`${API_BASE}/api/campaigns`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        alert('Campaign created successfully'); 
        closeModal(); 
        loadCampaigns();
        if (window.location.pathname.includes('dashboard')) loadDashboard();
    } catch(e) { 
        alert('Error: ' + e.message); 
    }
}

// ============ WALLET ============
async function loadWallet() {
    await loadUser();
    if (!currentUser) return;
    
    document.getElementById('balanceAmount').innerText = `$${(currentUser.balance || 0).toFixed(2)}`;
    
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    
    try {
        const orders = await getUserOrders(currentUser.id, currentUser.user_type);
        const active = (orders || []).filter(o => o.status !== 'released' && o.status !== 'posted');
        
        if (active.length === 0) { 
            ordersList.innerHTML = '<div class="activity-item">No active orders</div>'; 
        } else {
            ordersList.innerHTML = active.map(o => `
                <div class="activity-item">
                    <strong>Order #${o.id}</strong> - $${(o.amount || 0).toFixed(2)}
                    <span style="float:right" class="status-${o.status}">${o.status.toUpperCase()}</span>
                    <div style="margin-top: 8px;">
                        ${o.status === 'pending' ? `<button class="btn-secondary" onclick="lockPayment(${o.id})">Lock Payment</button>` : ''}
                        ${o.status === 'locked' ? `<button class="btn-primary" onclick="releasePayment(${o.id})">Confirm & Release</button>` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        const historyList = document.getElementById('historyList');
        const completed = (orders || []).filter(o => o.status === 'released');
        if (completed.length === 0) {
            historyList.innerHTML = '<div class="activity-item">No transaction history</div>';
        } else {
            historyList.innerHTML = completed.map(o => `
                <div class="activity-item">
                    Payment released for Order #${o.id} - $${(o.amount || 0).toFixed(2)}
                    <span style="float:right; font-size:12px; color:#6b7280;">${new Date(o.posted_at || o.created_at).toLocaleDateString()}</span>
                </div>
            `).join('');
        }
    } catch(e) { 
        console.error(e);
        ordersList.innerHTML = '<div class="activity-item">Error loading orders</div>';
    }
}

async function lockPayment(orderId) {
    try { 
        const res = await fetch(`${API_BASE}/api/orders/${orderId}/lock`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Payment locked in escrow'); 
        loadWallet(); 
        if (window.location.pathname.includes('dashboard')) loadDashboard();
    } catch(e) { 
        alert('Insufficient balance. Please add funds first.'); 
    }
}

async function releasePayment(orderId) {
    try {
        await fetch(`${API_BASE}/api/orders/${orderId}/confirm-post`, { method: 'POST' });
        await fetch(`${API_BASE}/api/orders/${orderId}/release`, { method: 'POST' });
        alert('Payment released to publisher'); 
        loadWallet(); 
        if (window.location.pathname.includes('dashboard')) loadDashboard();
    } catch(e) { 
        alert('Error releasing payment'); 
    }
}

async function addFunds() {
    const amount = prompt('Enter amount to add (USD):', '100');
    if (amount && amount >= 10 && amount <= 1000) {
        try {
            const res = await fetch(`${API_BASE}/api/users/${currentUser.telegram_id}/add-funds?amount=${amount}`, { method: 'POST' });
            const data = await res.json();
            currentUser.balance = data.new_balance;
            localStorage.setItem('akm_user', JSON.stringify(currentUser));
            
            if (document.getElementById('balanceAmount')) {
                document.getElementById('balanceAmount').innerText = `$${currentUser.balance.toFixed(2)}`;
            }
            if (document.getElementById('balanceVal')) {
                document.getElementById('balanceVal').innerText = `$${currentUser.balance.toFixed(2)}`;
            }
            alert(`Added $${amount}. New balance: $${currentUser.balance.toFixed(2)}`); 
            if (window.location.pathname.includes('dashboard')) loadDashboard();
        } catch(e) { 
            alert('Error adding funds'); 
        }
    } else {
        alert('Amount must be between $10 and $1000');
    }
}

// ============ UTILITY FUNCTIONS ============
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function viewAllActivity() {
    alert('All activity feature coming soon');
}

// ============ TAB FUNCTIONS FOR WALLET ============
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    if (!tabs.length) return;
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });
}

// ============ PAGE INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mobile menu
    initMobileMenu();
    
    // Initialize tabs (for wallet page)
    initTabs();
    
    // Load user data
    loadUser();
    
    // Page-specific initialization
    const path = window.location.pathname;
    
    if (path.includes('dashboard')) {
        loadDashboard();
    } 
    else if (path.includes('marketplace')) {
        loadMarketplace();
    } 
    else if (path.includes('campaigns')) { 
        loadCampaigns(); 
        const createBtn = document.getElementById('createCampaignBtn');
        if (createBtn) createBtn.addEventListener('click', showCreateModal);
        
        const submitBtn = document.getElementById('submitCampaign');
        if (submitBtn) submitBtn.addEventListener('click', createCampaign);
        
        const closeBtn = document.getElementById('closeModal');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        
        const cancelBtn = document.getElementById('cancelModal');
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    } 
    else if (path.includes('wallet')) { 
        loadWallet(); 
   