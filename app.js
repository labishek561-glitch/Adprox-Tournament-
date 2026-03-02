// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBD6BKSx3JJuU6s4BnB3tfb-lokMgAovDQ",
    authDomain: "free-fire-85936.firebaseapp.com",
    databaseURL: "https://free-fire-85936-default-rtdb.firebaseio.com",
    projectId: "free-fire-85936",
    storageBucket: "free-fire-85936.firebasestorage.app",
    messagingSenderId: "355177631012",
    appId: "1:355177631012:web:73046da88963213508b7b1"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// App State
let appState = {
    currentUser: null,
    userProfile: {},
    currentSection: 'login-section',
    currentGameFilter: null,
    currentMatchId: null,
    adminUid: "6630267204"
};

const countdownIntervals = {};

// DOM Elements
const elements = {
    sections: document.querySelectorAll('.section'),
    navItems: document.querySelectorAll('.bottom-nav .nav-item'),
    headerGreeting: document.getElementById('headerUserGreetingEl'),
    headerWallet: document.getElementById('headerWalletChipEl'),
    headerBalance: document.getElementById('headerChipBalanceEl'),
    toast: document.getElementById('toast'),
    loader: document.getElementById('loader'),
    loaderMessage: document.getElementById('loaderMessage'),
    myMatchesContainer: document.getElementById('myMatchesContainer'),
    myHostedMatchesContainer: document.getElementById('myHostedMatchesContainer'),
    tournamentsContainer: document.getElementById('tournamentsContainer'),
    gameTournamentsContainer: document.getElementById('gameTournamentsContainer'),
    brPlayersList: document.getElementById('brPlayersList'),
    walletBalance: document.getElementById('walletBalance'),
    walletDeposit: document.getElementById('walletDeposit'),
    walletWinning: document.getElementById('walletWinning'),
    walletBonus: document.getElementById('walletBonus'),
    transactionsList: document.getElementById('transactionsList'),
    withdrawalsList: document.getElementById('withdrawalsList'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profileMatches: document.getElementById('profileMatches'),
    profileWins: document.getElementById('profileWins'),
    profileEarnings: document.getElementById('profileEarnings'),
    adminSection: document.getElementById('admin-section'),
    leaderboardContainer: document.getElementById('leaderboardContainer'),
    adminResultsList: document.getElementById('adminResultsList'),
    adminPaymentsList: document.getElementById('adminPaymentsList'),
    adminReportsList: document.getElementById('adminReportsList'),
    adminComplaintsList: document.getElementById('adminComplaintsList'),
    matchHistoryList: document.getElementById('matchHistoryList'),
    winRate: document.getElementById('winRate'),
    totalEarningsStat: document.getElementById('totalEarningsStat'),
};

// Khelmela elements
const khelAvatar = document.getElementById('khelAvatar');
const khelUserName = document.getElementById('khelUserName');
const khelUserRole = document.getElementById('khelUserRole');
const khelBalance = document.getElementById('khelBalance');
const khelBalanceError = document.getElementById('khelBalanceError');

// ==================== HELPER FUNCTIONS ====================
function showToast(message, type = 'success') {
    const toast = elements.toast;
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderLeftColor = type === 'success' ? 'var(--success-color)' : 'var(--danger-color)';
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function showLoader(message = 'Please wait a moment...') {
    if (elements.loader) {
        elements.loader.style.display = 'flex';
        if (elements.loaderMessage) elements.loaderMessage.textContent = message;
    }
}

function hideLoader() {
    if (elements.loader) elements.loader.style.display = 'none';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return date.toLocaleDateString();
}

function formatCurrency(amount) {
    return 'NPR ' + (amount || 0).toFixed(2);
}

window.copyToClipboard = function(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.select();
        navigator.clipboard?.writeText(element.value).then(() => showToast('Copied!'));
    }
};

function getTotalBalance(profile = appState.userProfile) {
    return (Number(profile.depositBalance) || 0) +
           (Number(profile.winningCash) || 0) +
           (Number(profile.bonusCash) || 0);
}

function updateAllWalletDisplays() {
    if (!appState.currentUser) return;
    const total = getTotalBalance();
    if (elements.headerBalance) elements.headerBalance.textContent = Math.floor(total);
    if (elements.headerWallet) elements.headerWallet.style.display = 'flex';
    if (khelBalance) khelBalance.textContent = 'NPR ' + Math.floor(total);
    if (khelBalanceError) khelBalanceError.style.display = 'none';
    if (elements.walletBalance) elements.walletBalance.textContent = total.toFixed(2);
    if (elements.walletDeposit) elements.walletDeposit.textContent = (appState.userProfile.depositBalance || 0).toFixed(2);
    if (elements.walletWinning) elements.walletWinning.textContent = (appState.userProfile.winningCash || 0).toFixed(2);
    if (elements.walletBonus) elements.walletBonus.textContent = (appState.userProfile.bonusCash || 0).toFixed(2);
    const withdrawTotal = document.getElementById('withdrawTotalBalance');
    if (withdrawTotal) withdrawTotal.textContent = total.toFixed(2);
}

// ==================== WALLET OPERATIONS ====================
async function deductFromWallet(amount, reason, description) {
    if (!appState.currentUser) return false;
    const userId = appState.currentUser.uid;
    const userRef = db.ref(`users/${userId}`);
    try {
        const result = await userRef.transaction((user) => {
            if (!user) return user;
            let deposit = Number(user.depositBalance) || 0;
            let winning = Number(user.winningCash) || 0;
            let bonus = Number(user.bonusCash) || 0;
            let total = deposit + winning + bonus;
            if (total < amount) return;
            let remaining = amount;
            if (deposit >= remaining) { deposit -= remaining; remaining = 0; }
            else { remaining -= deposit; deposit = 0; }
            if (remaining > 0) {
                if (winning >= remaining) { winning -= remaining; remaining = 0; }
                else { remaining -= winning; winning = 0; }
            }
            if (remaining > 0) bonus -= remaining;
            user.depositBalance = deposit;
            user.winningCash = winning;
            user.bonusCash = bonus;
            return user;
        });
        if (!result.committed) return false;
        await db.ref(`transactions/${userId}`).push({
            type: reason,
            amount: -amount,
            description,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        const updated = await db.ref(`users/${userId}`).once('value');
        appState.userProfile = updated.val() || {};
        updateAllWalletDisplays();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function addToWallet(amount, reason, description, type = 'winning') {
    if (!appState.currentUser) return false;
    const userId = appState.currentUser.uid;
    const userRef = db.ref(`users/${userId}`);
    try {
        await userRef.transaction((current) => {
            if (!current) return current;
            const updates = { ...current };
            if (type === 'winning') updates.winningCash = (Number(current.winningCash) || 0) + amount;
            else if (type === 'deposit') updates.depositBalance = (Number(current.depositBalance) || 0) + amount;
            else if (type === 'bonus') updates.bonusCash = (Number(current.bonusCash) || 0) + amount;
            return updates;
        });
        await db.ref(`transactions/${userId}`).push({
            type: reason,
            amount: amount,
            description,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        const updated = await db.ref(`users/${userId}`).once('value');
        appState.userProfile = updated.val() || {};
        updateAllWalletDisplays();
        return true;
    } catch (error) {
        console.error('Add to wallet failed:', error);
        return false;
    }
}

// ==================== ONE-ACTIVE-MATCH CHECK ====================
async function userHasActiveMatch() {
    if (!appState.currentUser) return false;
    const uid = appState.currentUser.uid;
    const tournamentsSnap = await db.ref('tournaments').once('value');
    const tournaments = tournamentsSnap.val() || {};
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.status === 'upcoming' || t.status === 'ongoing') {
            if (t.hostId === uid || (t.registeredPlayers && t.registeredPlayers[uid])) {
                return true;
            }
        }
    }
    return false;
}

// ==================== SECTION SWITCHING ====================
function showSection(sectionId) {
    elements.sections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
    appState.currentSection = sectionId;
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
    switch (sectionId) {
        case 'home-section': loadHomeData(); break;
        case 'tournaments-section':
            document.getElementById('showMatchesBtn')?.click();
            break;
        case 'game-tournaments-section':
            if (appState.currentGameFilter) loadGameTournaments(appState.currentGameFilter);
            break;
        case 'br-section':
            loadAdminTournaments('upcoming');
            break;
        case 'wallet-section': loadWalletData(); break;
        case 'withdraw-section': loadWithdrawSection(); break;
        case 'profile-section': loadProfileData(); break;
        case 'host-section': updateHostPreview(); break;
        case 'result-section': loadResultMatches(); break;
        case 'admin-section':
            if (appState.userProfile.role === 'admin') {
                loadAdminResults();
                loadAdminPayments();
                loadAdminComplaints();
            }
            break;
    }
}

// ==================== GAME CARDS ====================
document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
        const gameId = card.dataset.gameId;
        const gameName = card.querySelector('span')?.textContent || 'Game';
        appState.currentGameFilter = gameId;
        const titleEl = document.getElementById('selectedGameTitle');
        if (titleEl) titleEl.textContent = `${gameName} Tournaments`;
        showSection('game-tournaments-section');
    });
});

document.getElementById('backToHomeBtn')?.addEventListener('click', () => showSection('home-section'));

// ==================== RENDER GAME-SPECIFIC OPTIONS ====================
function renderGameOptions(t) {
    if (!t.gameOptions) return '';
    const game = t.game;
    const opts = t.gameOptions;
    let html = '<div class="game-options mb-2">';
    if (game === 'freefire') {
        if (opts.mode) html += `<span class="badge bg-info me-1">Mode: ${opts.mode}</span>`;
        if (opts.playerFormat) html += `<span class="badge bg-info me-1">Format: ${opts.playerFormat}</span>`;
        if (opts.limitedAmmo) html += `<span class="badge bg-info me-1">Ammo: ${opts.limitedAmmo}</span>`;
        if (opts.gunAttribute) html += `<span class="badge bg-info me-1">GunAttr: ${opts.gunAttribute}</span>`;
        if (opts.headshot) html += `<span class="badge bg-info me-1">Headshot: ${opts.headshot}</span>`;
        if (opts.characterSkill) html += `<span class="badge bg-info me-1">Skill: ${opts.characterSkill}</span>`;
        if (opts.itemsMode) html += `<span class="badge bg-info me-1">Items: ${opts.itemsMode}</span>`;
    } else if (game === 'pubg') {
        if (opts.matchType) html += `<span class="badge bg-info me-1">Type: ${opts.matchType}</span>`;
        if (opts.perspective) html += `<span class="badge bg-info me-1">Perspective: ${opts.perspective}</span>`;
        if (opts.weather) html += `<span class="badge bg-info me-1">Weather: ${opts.weather}</span>`;
    } else if (game === 'cod') {
        if (opts.gameMode) html += `<span class="badge bg-info me-1">Mode: ${opts.gameMode}</span>`;
        if (opts.map) html += `<span class="badge bg-info me-1">Map: ${opts.map}</span>`;
    } else if (game === 'mobilelegend') {
        if (opts.gameMode) html += `<span class="badge bg-info me-1">Mode: ${opts.gameMode}</span>`;
        if (opts.lane) html += `<span class="badge bg-info me-1">Lane: ${opts.lane}</span>`;
    }
    html += '</div>';
    return html;
}

// ==================== RENDER FUNCTIONS ====================
function renderTournamentCard(id, t) {
    const registeredCount = t.registeredPlayers ? Object.keys(t.registeredPlayers).length : 0;
    const maxPlayers = t.maxPlayers || 2;
    const isFull = registeredCount >= maxPlayers;

    const joined = appState.currentUser && t.registeredPlayers && t.registeredPlayers[appState.currentUser.uid];
    const isHost = t.hostId === appState.currentUser?.uid;
    const isAdmin = appState.userProfile?.role === 'admin';

    let showJoin = false;
    if (!joined && !isHost && t.status === 'upcoming' && !isFull) {
        showJoin = true;
    }

    // Room details (only if match is ongoing and details provided)
    let roomHtml = '';
    if (t.status === 'ongoing' && t.showIdPass && t.roomId && t.roomPassword) {
        roomHtml = `
            <div class="room-details mt-2">
                <div class="input-group mb-2">
                    <input type="text" class="form-control" value="${t.roomId}" readonly>
                    <button class="btn-custom btn-custom-secondary" onclick="copyToClipboard('${t.roomId}')">Copy</button>
                </div>
                <div class="input-group">
                    <input type="text" class="form-control" value="${t.roomPassword}" readonly>
                    <button class="btn-custom btn-custom-secondary" onclick="copyToClipboard('${t.roomPassword}')">Copy</button>
                </div>
            </div>
        `;
    }

    // Provide Room Details button (visible to host OR admin if at least one player joined and details not yet provided)
    let provideButton = '';
    if ((isHost || (t.isAdminTournament && isAdmin)) && t.status === 'upcoming' && !t.showIdPass && registeredCount > 0) {
        provideButton = `<button class="btn-custom btn-custom-primary btn-sm provide-room mt-2" data-id="${id}">Provide Room Details</button>`;
    }

    // Prize calculation
    const prizeDisplay = t.prizePool ? formatCurrency(t.prizePool) : 'N/A';

    const countdownId = `countdown-${id}`;
    const matchDate = t.matchDate ? new Date(t.matchDate).toLocaleString() : 'TBD';

    // I Won / I Lost buttons
    let resultButtons = '';
    if (joined && t.status === 'ongoing' && !t.winnerId) {
        resultButtons = `
            <button class="btn-custom btn-custom-success flex-grow-1 claim-win" data-id="${id}">I Won</button>
            <button class="btn-custom btn-custom-danger flex-grow-1 claim-lost" data-id="${id}">I Lost</button>
        `;
    }

    // Chat button
    const chatButton = `<button class="btn-custom btn-custom-secondary btn-sm chat-tournament" data-id="${id}"><i class="bi bi-chat"></i> Chat</button>`;

    // Host controls (edit/delete) for user-hosted matches only
    let hostControls = '';
    if (!t.isAdminTournament && isHost && t.status === 'upcoming') {
        hostControls = `
            <div class="mt-2 d-flex gap-2">
                <button class="btn-custom btn-custom-secondary btn-sm edit-tournament" data-id="${id}"><i class="bi bi-pencil"></i> Edit</button>
                <button class="btn-custom btn-custom-danger btn-sm delete-tournament" data-id="${id}"><i class="bi bi-trash"></i> Delete</button>
            </div>
        `;
    }

    // Get match type from gameOptions
    let matchType = '';
    if (t.gameOptions) {
        if (t.game === 'freefire') matchType = t.gameOptions.playerFormat || '';
        else if (t.game === 'pubg') matchType = t.gameOptions.matchType || '';
        else if (t.game === 'cod') matchType = t.gameOptions.gameMode || '';
        else if (t.game === 'mobilelegend') matchType = t.gameOptions.gameMode || '';
    }

    return `
        <div class="tournament-card" data-id="${id}" data-created="${t.createdAt || Date.now()}" data-fullsince="${t.fullSince || ''}">
            <div class="tournament-header">
                <span class="tournament-badge">${t.game || 'Game'}</span>
                <span class="status-badge ${t.status === 'ongoing' ? 'status-live' : t.status === 'completed' ? 'status-completed' : 'status-waiting'}">${t.status}</span>
            </div>
            <img src="https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png" class="tournament-image" style="height: 80px; object-fit: contain; margin-bottom: 10px;">
            <h6>${t.name || 'Match'}</h6>
            ${matchType ? `<p class="small text-secondary mb-1"><strong>Type:</strong> ${matchType}</p>` : ''}
            ${!t.isAdminTournament ? `
            <div class="host-info">
                <img src="${t.hostAvatar || 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png'}" class="host-avatar">
                <div class="host-details">
                    <div class="host-name">${t.hostName || 'Host'}</div>
                    <div class="host-label">UID: ${t.hostUid || 'N/A'}</div>
                </div>
            </div>
            ` : ''}
            <p class="small text-secondary mb-1">📅 ${matchDate}</p>
            <p class="small text-secondary mb-1">Entry: ${formatCurrency(t.entryFee)}</p>
            <p class="small text-accent mb-2"><strong>Prize: ${prizeDisplay}</strong></p>
            <p class="small text-secondary mb-2">
                Players: ${registeredCount}/${maxPlayers}
                ${isFull ? '<span class="match-full-badge ms-2">Full</span>' : ''}
            </p>
            ${t.status === 'upcoming' ? `<div class="countdown" id="${countdownId}"></div>` : ''}
            ${roomHtml}
            ${provideButton}
            <div class="d-flex gap-2 mt-2">
                ${chatButton}
                ${showJoin ? '<button class="btn-custom btn-custom-accent flex-grow-1 join-tournament" data-id="' + id + '">Join (NPR ' + t.entryFee + ')</button>' : ''}
                ${resultButtons}
                ${isFull && t.status === 'upcoming' ? '<button class="btn-custom btn-custom-secondary flex-grow-1" disabled>Match Full</button>' : ''}
            </div>
            ${hostControls}
        </div>
    `;
  }
          function renderHostedCard(id, t) {
    // Simplified for hosted matches (used in home section)
    const registeredCount = t.registeredPlayers ? Object.keys(t.registeredPlayers).length : 0;
    const maxPlayers = t.maxPlayers || 2;
    const joinerId = Object.keys(t.registeredPlayers || {}).find(uid => uid !== t.hostId);
    const joiner = joinerId ? t.registeredPlayers[joinerId] : null;
    const totalPool = t.entryFee * maxPlayers;
    const prize = totalPool - (totalPool * 0.05);
    const showProvide = t.status === 'upcoming' && !t.showIdPass && registeredCount > 0;

    return `
        <div class="tournament-card" data-id="${id}">
            <img src="https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png" class="tournament-image">
            <h6>${t.name || 'Match'}</h6>
            <div class="host-info">
                <img src="${appState.userProfile.photoURL || 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png'}" class="host-avatar">
                <div class="host-details">
                    <div class="host-name">You</div>
                    <div class="host-label">UID: ${t.hostUid || 'N/A'}</div>
                </div>
            </div>
            <p class="small text-secondary">Entry: ${formatCurrency(t.entryFee)} | Prize: ${formatCurrency(prize)}</p>
            <p class="small text-secondary">Players: ${registeredCount}/${maxPlayers}</p>
            ${joiner ? `<p class="small text-accent">Opponent: ${joiner.name}</p>` : ''}
            ${showProvide ? '<button class="btn-custom btn-custom-primary provide-room mt-2" data-id="' + id + '">Provide Room Details</button>' : ''}
            <span class="status-badge ${t.status === 'ongoing' ? 'status-live' : 'status-waiting'} mt-2 d-inline-block">${t.status || 'upcoming'}</span>
        </div>
    `;
}

// ==================== LOAD FUNCTIONS ====================
async function loadGameTournaments(gameId) {
    if (!gameId) return;
    const snapshot = await db.ref('tournaments').once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.game === gameId && t.status !== 'completed') {
            html += renderTournamentCard(id, t);
        }
    }
    if (elements.gameTournamentsContainer) {
        elements.gameTournamentsContainer.innerHTML = html || '<p class="text-secondary text-center">No tournaments found</p>';
    }
    attachTournamentListeners();
    startCountdowns();
}

async function loadTournaments(status) {
    const snapshot = await db.ref('tournaments').once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.status === status) {
            html += renderTournamentCard(id, t);
        }
    }
    if (elements.tournamentsContainer) {
        elements.tournamentsContainer.innerHTML = html || '<p class="text-secondary text-center">No tournaments found</p>';
    }
    attachTournamentListeners();
    startCountdowns();
}

async function loadHomeData() {
    if (!appState.currentUser) return;
    const joined = appState.userProfile.joinedTournaments || {};
    let matchesHtml = '';
    for (const [id] of Object.entries(joined)) {
        const snap = await db.ref(`tournaments/${id}`).once('value');
        const t = snap.val();
        if (t && t.status !== 'completed') {
            matchesHtml += renderTournamentCard(id, t);
        }
    }
    if (elements.myMatchesContainer) {
        elements.myMatchesContainer.innerHTML = matchesHtml || '<p class="text-secondary text-center">No matches joined yet</p>';
    }
    const hostedSnap = await db.ref('tournaments').orderByChild('hostId').equalTo(appState.currentUser.uid).once('value');
    const hosted = hostedSnap.val() || {};
    let hostedHtml = '';
    for (const [id, t] of Object.entries(hosted)) {
        if (t.status !== 'completed') {
            hostedHtml += renderHostedCard(id, t);
        }
    }
    if (elements.myHostedMatchesContainer) {
        elements.myHostedMatchesContainer.innerHTML = hostedHtml || '<p class="text-secondary text-center">No matches hosted yet</p>';
    }
    attachTournamentListeners();
    startCountdowns();
}

function attachTournamentListeners() {
    document.querySelectorAll('.join-tournament').forEach(btn => {
        btn.removeEventListener('click', joinHandler);
        btn.addEventListener('click', joinHandler);
    });
    document.querySelectorAll('.provide-room').forEach(btn => {
        btn.removeEventListener('click', provideHandler);
        btn.addEventListener('click', provideHandler);
    });
    document.querySelectorAll('.claim-win').forEach(btn => {
        btn.removeEventListener('click', claimWinHandler);
        btn.addEventListener('click', claimWinHandler);
    });
    document.querySelectorAll('.claim-lost').forEach(btn => {
        btn.removeEventListener('click', claimLostHandler);
        btn.addEventListener('click', claimLostHandler);
    });
    document.querySelectorAll('.chat-tournament').forEach(btn => {
        btn.removeEventListener('click', chatHandler);
        btn.addEventListener('click', chatHandler);
    });
    document.querySelectorAll('.edit-tournament').forEach(btn => {
        btn.removeEventListener('click', editTournamentHandler);
        btn.addEventListener('click', editTournamentHandler);
    });
    document.querySelectorAll('.delete-tournament').forEach(btn => {
        btn.removeEventListener('click', deleteTournamentHandler);
        btn.addEventListener('click', deleteTournamentHandler);
    });
}

// ==================== TOURNAMENT HANDLERS ====================
async function joinHandler(e) {
    const tournamentId = e.target.dataset.id;
    if (!appState.currentUser) { showToast('Login first', 'error'); return; }

    // One-active-match restriction
    if (await userHasActiveMatch()) {
        showToast('You already have an active match. Please finish or delete it first.', 'error');
        return;
    }

    showLoader('Joining match...');
    try {
        const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
        const t = snap.val();
        if (!t) { showToast('Tournament not found', 'error'); return; }
        if (t.hostId === appState.currentUser.uid) { showToast('You cannot join your own match', 'error'); return; }
        if (t.registeredPlayers && t.registeredPlayers[appState.currentUser.uid]) { showToast('Already joined', 'info'); return; }
        const registeredCount = Object.keys(t.registeredPlayers || {}).length;
        const maxPlayers = t.maxPlayers || 2;
        if (registeredCount >= maxPlayers) { showToast('Match is full', 'error'); return; }
        const totalBalance = getTotalBalance();
        if (totalBalance < t.entryFee) { showToast('Insufficient balance', 'error'); return; }
        const deducted = await deductFromWallet(t.entryFee, 'join_fee', `Joined match: ${t.name}`);
        if (!deducted) { showToast('Failed to deduct entry fee', 'error'); return; }
        const updates = {};
        updates[`tournaments/${tournamentId}/registeredPlayers/${appState.currentUser.uid}`] = {
            uid: appState.currentUser.uid,
            name: appState.userProfile.displayName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        updates[`users/${appState.currentUser.uid}/joinedTournaments/${tournamentId}`] = true;
        if (registeredCount + 1 === maxPlayers) {
            updates[`tournaments/${tournamentId}/status`] = 'ongoing';
            updates[`tournaments/${tournamentId}/fullSince`] = firebase.database.ServerValue.TIMESTAMP;
        }
        await db.ref().update(updates);
        showToast('Joined successfully!');
        loadHomeData();
        if (appState.currentSection === 'game-tournaments-section' && appState.currentGameFilter) {
            loadGameTournaments(appState.currentGameFilter);
        }
        // Refresh admin tournaments if open
        if (appState.currentSection === 'br-section') {
            const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
            loadAdminTournaments(activeTab);
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
}

async function provideHandler(e) {
    const tournamentId = e.target.dataset.id;
    appState.currentMatchId = tournamentId;
    const modal = new bootstrap.Modal(document.getElementById('provideRoomModal'));
    modal.show();
}

document.getElementById('submitProvideRoomBtn')?.addEventListener('click', async () => {
    const roomId = document.getElementById('provideRoomId')?.value.trim();
    const password = document.getElementById('provideRoomPassword')?.value.trim();
    if (!roomId || !password) { showToast('Fill both fields', 'error'); return; }
    showLoader();
    try {
        await db.ref(`tournaments/${appState.currentMatchId}`).update({
            roomId, roomPassword: password, showIdPass: true,
            roomProvidedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Room details provided');
        bootstrap.Modal.getInstance(document.getElementById('provideRoomModal')).hide();
        document.getElementById('provideRoomId').value = '';
        document.getElementById('provideRoomPassword').value = '';
        loadHomeData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
});

async function claimWinHandler(e) {
    const tournamentId = e.target.dataset.id;
    if (!appState.currentUser) return;
    const select = document.getElementById('resultMatchSelect');
    if (select) {
        const option = document.querySelector(`#resultMatchSelect option[value="${tournamentId}"]`);
        if (option) select.value = tournamentId;
        else {
            const newOption = document.createElement('option');
            newOption.value = tournamentId;
            newOption.textContent = `Match ${tournamentId}`;
            select.appendChild(newOption);
            select.value = tournamentId;
        }
    }
    showSection('result-section');
}

async function claimLostHandler(e) {
    const tournamentId = e.target.dataset.id;
    showToast('You can rate your opponent from the profile section after match.', 'info');
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (t) {
        const opponentId = Object.keys(t.registeredPlayers || {}).find(uid => uid !== appState.currentUser.uid);
        if (opponentId) openRatingModal(tournamentId, opponentId);
    }
}

function chatHandler(e) {
    const tournamentId = e.target.closest('.chat-tournament').dataset.id;
    openChat(tournamentId);
}

async function editTournamentHandler(e) {
    const id = e.target.closest('.edit-tournament')?.dataset.id;
    if (!id) return;
    const snap = await db.ref(`tournaments/${id}`).once('value');
    const t = snap.val();
    if (t.hostId !== appState.currentUser.uid) return showToast('Unauthorized', 'error');
    document.getElementById('editTournamentId').value = id;
    document.getElementById('editRoomPassword').value = t.roomPassword || '';
    document.getElementById('editHostUid').value = t.hostUid || '';
    new bootstrap.Modal(document.getElementById('editTournamentModal')).show();
}

document.getElementById('saveEditTournamentBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('editTournamentId').value;
    const roomPassword = document.getElementById('editRoomPassword').value;
    const hostUid = document.getElementById('editHostUid').value;
    await db.ref(`tournaments/${id}`).update({ roomPassword, hostUid });
    showToast('Tournament updated');
    bootstrap.Modal.getInstance(document.getElementById('editTournamentModal')).hide();
    loadHomeData();
});

async function deleteTournamentHandler(e) {
    const id = e.target.closest('.delete-tournament')?.dataset.id;
    if (!id) return;
    window.tournamentToDelete = id;
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    const id = window.tournamentToDelete;
    if (!id) return;
    await db.ref(`tournaments/${id}`).remove();
    showToast('Tournament deleted');
    bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
    loadHomeData();
    // Refresh admin tournaments if open
    if (appState.currentSection === 'br-section') {
        const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
        loadAdminTournaments(activeTab);
    }
});

// ==================== COUNTDOWN AND AUTO-CANCEL ====================
function startCountdowns() {
    document.querySelectorAll('[id^="countdown-"]').forEach(el => {
        const id = el.id.replace('countdown-', '');
        const card = document.querySelector(`.tournament-card[data-id="${id}"]`);
        if (!card) return;

        const createdAt = parseInt(card.dataset.created);
        const fullSince = parseInt(card.dataset.fullsince);

        if (fullSince) {
            // Match is full, waiting for room details
            const expiry = fullSince + 5 * 60 * 1000;
            const updateTimer = () => {
                const now = Date.now();
                const remaining = expiry - now;
                if (remaining <= 0) {
                    el.textContent = '⏰ Auto-cancelled (no room)';
                    clearInterval(countdownIntervals[id]);
                    delete countdownIntervals[id];
                    autoCancelFullMatch(id);
                } else {
                    const mins = Math.floor(remaining / 60000);
                    const secs = Math.floor((remaining % 60000) / 1000);
                    el.textContent = `⏳ Room details in ${mins}m ${secs}s`;
                }
            };
            updateTimer();
            if (countdownIntervals[id]) clearInterval(countdownIntervals[id]);
            countdownIntervals[id] = setInterval(updateTimer, 1000);
        } else if (createdAt) {
            // Original auto-cancel if not enough players after creation
            const expiry = createdAt + 5 * 60 * 1000;
            const updateTimer = () => {
                const now = Date.now();
                const remaining = expiry - now;
                if (remaining <= 0) {
                    el.textContent = '⏰ Expired';
                    clearInterval(countdownIntervals[id]);
                    delete countdownIntervals[id];
                    autoCancelMatch(id);
                } else {
                    const mins = Math.floor(remaining / 60000);
                    const secs = Math.floor((remaining % 60000) / 1000);
                    el.textContent = `⏳ Auto-cancel in ${mins}m ${secs}s`;
                }
            };
            updateTimer();
            if (countdownIntervals[id]) clearInterval(countdownIntervals[id]);
            countdownIntervals[id] = setInterval(updateTimer, 1000);
        }
    });
}

async function autoCancelMatch(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (!t || t.status !== 'upcoming') return;

    const registeredCount = Object.keys(t.registeredPlayers || {}).length;
    const maxPlayers = t.maxPlayers || 2;

    if (registeredCount < maxPlayers) {
        // Refund host only (since only host joined)
        await addToWallet(t.entryFee, 'refund', 'Match cancelled (no opponent)', 'deposit');
        await db.ref(`tournaments/${tournamentId}`).remove();
        showToast('Match cancelled due to inactivity', 'info');
    }
            }
      async function autoCancelFullMatch(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (!t || t.status !== 'upcoming' || t.showIdPass) return; // already provided

    // Refund all registered players
    const players = t.registeredPlayers || {};
    for (const uid in players) {
        await addToWallet(t.entryFee, 'refund', 'Match cancelled (host did not provide room)', 'deposit');
    }
    await db.ref(`tournaments/${tournamentId}`).remove();
    showToast('Match cancelled: host did not provide room details', 'info');
}

// ==================== GAME‑SPECIFIC OPTIONS FOR HOST ====================
const gameOptionsTemplates = {
    freefire: `
        <div class="khel-field-group">
            <label class="khel-field-label">Room Mode</label>
            <select class="khel-field-input" id="hostFFMode">
                <option value="clash_squad">Clash Squad</option>
                <option value="lone_wolf">Lone Wolf</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Player Format</label>
            <select class="khel-field-input" id="hostFFPlayers">
                <option value="1v1">1v1</option>
                <option value="2v2">2v2</option>
                <option value="3v3">3v3</option>
                <option value="4v4">4v4</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Limited Ammo</label>
            <select class="khel-field-input" id="hostFFAmmo">
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Gun Attribute</label>
            <select class="khel-field-input" id="hostFFGunAttr">
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Headshot Only</label>
            <select class="khel-field-input" id="hostFFHeadshot">
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Character Skill</label>
            <select class="khel-field-input" id="hostFFSkill">
                <option value="yes">Yes</option>
                <option value="no">No</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Game Items Mode</label>
            <select class="khel-field-input" id="hostFFItems">
                <option value="default">Default</option>
                <option value="custom">Custom</option>
            </select>
        </div>
    `,
    pubg: `
        <div class="khel-field-group">
            <label class="khel-field-label">Match Type</label>
            <select class="khel-field-input" id="hostPUBGType">
                <option value="classic">Classic</option>
                <option value="arena">Arena</option>
                <option value="tdm">TDM</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Perspective</label>
            <select class="khel-field-input" id="hostPUBGPerspective">
                <option value="tpp">TPP</option>
                <option value="fpp">FPP</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Weather</label>
            <select class="khel-field-input" id="hostPUBGWeather">
                <option value="sunny">Sunny</option>
                <option value="rain">Rain</option>
                <option value="fog">Fog</option>
            </select>
        </div>
    `,
    cod: `
        <div class="khel-field-group">
            <label class="khel-field-label">Game Mode</label>
            <select class="khel-field-input" id="hostCODMode">
                <option value="mp">Multiplayer</option>
                <option value="br">Battle Royale</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Map</label>
            <select class="khel-field-input" id="hostCODMap">
                <option value="standoff">Standoff</option>
                <option value="firing_range">Firing Range</option>
                <option value="crossfire">Crossfire</option>
            </select>
        </div>
    `,
    mobilelegend: `
        <div class="khel-field-group">
            <label class="khel-field-label">Game Mode</label>
            <select class="khel-field-input" id="hostMLMode">
                <option value="classic">Classic</option>
                <option value="rank">Rank</option>
                <option value="brawl">Brawl</option>
            </select>
        </div>
        <div class="khel-field-group">
            <label class="khel-field-label">Lane</label>
            <select class="khel-field-input" id="hostMLLane">
                <option value="any">Any</option>
                <option value="gold">Gold</option>
                <option value="exp">EXP</option>
                <option value="mid">Mid</option>
                <option value="jungle">Jungle</option>
                <option value="roam">Roam</option>
            </select>
        </div>
    `
};

// Update options when game changes
document.getElementById('hostGame')?.addEventListener('change', function() {
    const game = this.value;
    const container = document.getElementById('gameSpecificOptions');
    if (gameOptionsTemplates[game]) {
        container.innerHTML = gameOptionsTemplates[game];
    } else {
        container.innerHTML = ''; // fallback
    }
});

// Trigger initial load
if (document.getElementById('hostGame')) {
    document.getElementById('hostGame').dispatchEvent(new Event('change'));
}

// ==================== HOST MATCH CREATION ====================
document.getElementById('openHostConfirmModal')?.addEventListener('click', async () => {
    if (!appState.currentUser) {
        showToast('Login first', 'error');
        return;
    }

    // One-active-match restriction
    if (await userHasActiveMatch()) {
        showToast('You already have an active match. Please finish or delete it first.', 'error');
        return;
    }

    const fresh = await db.ref(`users/${appState.currentUser.uid}`).once('value');
    appState.userProfile = fresh.val() || {};
    updateAllWalletDisplays();

    const game = document.getElementById('hostGame')?.value;
    const uid = document.getElementById('hostUid')?.value;
    const fee = parseInt(document.getElementById('hostFee')?.value);

    // Collect game‑specific options
    const gameOptions = {};
    if (game === 'freefire') {
        gameOptions.mode = document.getElementById('hostFFMode')?.value;
        gameOptions.playerFormat = document.getElementById('hostFFPlayers')?.value;
        gameOptions.limitedAmmo = document.getElementById('hostFFAmmo')?.value;
        gameOptions.gunAttribute = document.getElementById('hostFFGunAttr')?.value;
        gameOptions.headshot = document.getElementById('hostFFHeadshot')?.value;
        gameOptions.characterSkill = document.getElementById('hostFFSkill')?.value;
        gameOptions.itemsMode = document.getElementById('hostFFItems')?.value;
    } else if (game === 'pubg') {
        gameOptions.matchType = document.getElementById('hostPUBGType')?.value;
        gameOptions.perspective = document.getElementById('hostPUBGPerspective')?.value;
        gameOptions.weather = document.getElementById('hostPUBGWeather')?.value;
    } else if (game === 'cod') {
        gameOptions.gameMode = document.getElementById('hostCODMode')?.value;
        gameOptions.map = document.getElementById('hostCODMap')?.value;
    } else if (game === 'mobilelegend') {
        gameOptions.gameMode = document.getElementById('hostMLMode')?.value;
        gameOptions.lane = document.getElementById('hostMLLane')?.value;
    }

    if (!uid || !fee || fee < 10 || fee > 1000) {
        showToast('Please fill all fields correctly', 'error');
        return;
    }

    const totalBalance = getTotalBalance();
    if (totalBalance < fee) {
        if (khelBalanceError) khelBalanceError.style.display = 'block';
        showToast('Insufficient balance', 'error');
        return;
    }
    if (khelBalanceError) khelBalanceError.style.display = 'none';

    document.getElementById('confirmEntryFee').value = formatCurrency(fee);
    const totalPool = fee * 2;
    const platformFee = totalPool * 0.05;
    const winningPrize = totalPool - platformFee;

    document.getElementById('confirmTotalPool').value = formatCurrency(totalPool);
    document.getElementById('confirmPlatformFee').value = formatCurrency(platformFee);
    document.getElementById('confirmWinningPrize').value = formatCurrency(winningPrize);

    window.pendingHostData = { game, uid, fee, gameOptions };
    new bootstrap.Modal(document.getElementById('hostConfirmModal')).show();
});

document.getElementById('confirmHostBtn')?.addEventListener('click', async () => {
    const data = window.pendingHostData;
    if (!data) return;
    bootstrap.Modal.getInstance(document.getElementById('hostConfirmModal')).hide();
    showLoader('Creating match...');
    try {
        const deducted = await deductFromWallet(data.fee, 'host_fee', `Hosted ${data.game} match`);
        if (!deducted) {
            showToast('Insufficient balance', 'error');
            return;
        }
        const matchDate = new Date().toISOString();
        const tournamentData = {
            game: data.game,
            name: `${data.game} 1v1 Match`,
            hostId: appState.currentUser.uid,
            hostName: appState.userProfile.displayName,
            hostUid: data.uid,
            hostAvatar: appState.userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(appState.userProfile.displayName || 'User')}&background=ffd700&color=000&size=35`,
            entryFee: data.fee,
            status: 'upcoming',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            matchDate: matchDate,
            maxPlayers: 2,
            registeredPlayers: {},
            showIdPass: false,
            roomId: '',
            roomPassword: '',
            gameOptions: data.gameOptions,
            isAdminTournament: false
        };
        tournamentData.registeredPlayers[appState.currentUser.uid] = {
            uid: appState.currentUser.uid,
            name: appState.userProfile.displayName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        const newRef = await db.ref('tournaments').push(tournamentData);
        const tournamentId = newRef.key;
        await db.ref(`users/${appState.currentUser.uid}/joinedTournaments/${tournamentId}`).set(true);
        showToast('Match created!');
        document.getElementById('hostMatchForm')?.reset();
        document.getElementById('hostFee').value = '10';
        // Reset game options
        document.getElementById('hostGame').dispatchEvent(new Event('change'));
        showSection('home-section');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
});

// ==================== ADMIN TOURNAMENT CREATION ====================
document.getElementById('adminCreateTournamentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!appState.currentUser || appState.userProfile.role !== 'admin') {
        showToast('Admin access required', 'error');
        return;
    }
    const game = document.getElementById('adminGameSelect').value;
    const matchDateTime = document.getElementById('adminMatchDateTime').value;
    const entryFee = parseInt(document.getElementById('adminEntryFee').value);
    const prizePool = parseInt(document.getElementById('adminPrizePool').value) || 0;
    const maxPlayers = parseInt(document.getElementById('adminMaxPlayers').value);
    const name = document.getElementById('adminTournamentName').value || `${game} Admin Tournament`;

    if (!matchDateTime || !entryFee || !maxPlayers) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    showLoader('Creating tournament...');
    try {
        const tournamentData = {
            game,
            name,
            hostId: appState.adminUid,
            hostName: 'Admin',
            hostUid: 'ADMIN',
            hostAvatar: 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png',
            entryFee,
            prizePool,
            maxPlayers,
            matchDate: new Date(matchDateTime).getTime(),
            status: 'upcoming',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            registeredPlayers: {},
            showIdPass: false,
            roomId: '',
            roomPassword: '',
            isAdminTournament: true
        };
        await db.ref('tournaments').push(tournamentData);
        showToast('Tournament created successfully!');
        document.getElementById('adminCreateTournamentForm').reset();
        // Refresh admin tournaments
        const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
        loadAdminTournaments(activeTab);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
});

// ==================== ADMIN TOURNAMENT TABS ====================
async function loadAdminTournaments(status) {
    const snapshot = await db.ref('tournaments').once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.isAdminTournament && t.status === status) {
            html += renderTournamentCard(id, t);
        }
    }
    const container = document.getElementById('adminTournamentsContainer');
    if (container) {
        container.innerHTML = html || '<p class="text-secondary text-center">No tournaments found</p>';
    }
    attachTournamentListeners();
    startCountdowns();
}

// Tab switching for admin tournaments
document.querySelectorAll('[data-admin-status]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-admin-status]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        loadAdminTournaments(this.dataset.adminStatus);
    });
});

        // ==================== WALLET ====================
async function loadWalletData() {
    if (!appState.currentUser) return;
    updateAllWalletDisplays();
    const txSnap = await db.ref(`transactions/${appState.currentUser.uid}`).orderByChild('timestamp').limitToLast(20).once('value');
    const transactions = txSnap.val() || {};
    let txHtml = '';
    const sortedTx = Object.values(transactions).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    sortedTx.forEach(t => {
        if (t.description) {
            txHtml += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2" style="border-bottom: 1px solid var(--border-color);">
                    <div><small>${t.description}</small><div class="text-secondary small">${formatDate(t.timestamp)}</div></div>
                    <span class="${t.amount > 0 ? 'text-success' : 'text-danger'}">${t.amount > 0 ? '+' : ''}NPR ${Math.abs(t.amount)}</span>
                </div>
            `;
        }
    });
    if (elements.transactionsList) elements.transactionsList.innerHTML = txHtml || '<p class="text-secondary text-center">No transactions yet</p>';
    const withdrawSnap = await db.ref('withdrawals').orderByChild('userId').equalTo(appState.currentUser.uid).once('value');
    const withdrawals = withdrawSnap.val() || {};
    let withdrawHtml = '';
    const sortedWithdrawals = Object.values(withdrawals).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
    sortedWithdrawals.forEach(w => {
        const statusClass = w.status === 'approved' ? 'text-success' : (w.status === 'rejected' ? 'text-danger' : 'text-warning');
        withdrawHtml += `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2" style="border-bottom: 1px solid var(--border-color);">
                <div><small>Withdrawal to ${w.method}</small><div class="text-secondary small">${formatDate(w.timestamp)}</div><div><span class="${statusClass}">${w.status}</span></div></div>
                <span class="text-danger">-NPR ${w.amount}</span>
            </div>
        `;
    });
    if (elements.withdrawalsList) elements.withdrawalsList.innerHTML = withdrawHtml || '<p class="text-secondary text-center">No withdrawals yet</p>';
}

// ==================== WITHDRAW ====================
let selectedWithdrawMethod = 'esewa';
function updateWithdrawMethodFields(method) {
    const container = document.getElementById('withdrawMethodFields');
    if (!container) return;
    if (method === 'bank') {
        container.innerHTML = `
            <div class="mb-3"><label class="form-label">Bank Name</label><input type="text" class="form-control" id="withdrawBankName" placeholder="e.g., NMB Bank" required></div>
            <div class="mb-3"><label class="form-label">Account Number</label><input type="text" class="form-control" id="withdrawAccountNumber" placeholder="Enter account number" required></div>
            <div class="mb-3"><label class="form-label">Account Holder Name</label><input type="text" class="form-control" id="withdrawAccountName" placeholder="As on bank account" required></div>
        `;
    } else {
        container.innerHTML = `
            <div class="mb-3"><label class="form-label">${method === 'esewa' ? 'eSewa' : 'Khalti'} Number</label><input type="text" class="form-control" id="withdrawWalletNumber" placeholder="Enter ${method === 'esewa' ? 'eSewa' : 'Khalti'} number" required></div>
            <div class="mb-3"><label class="form-label">Account Holder Name</label><input type="text" class="form-control" id="withdrawAccountName" placeholder="Enter name" required></div>
        `;
    }
}
document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedWithdrawMethod = this.dataset.method;
        updateWithdrawMethodFields(selectedWithdrawMethod);
    });
});
function loadWithdrawSection() {
    if (!appState.currentUser) return;
    updateAllWalletDisplays();
    const amountEl = document.getElementById('withdrawAmount');
    if (amountEl) amountEl.value = '';
    const statusDiv = document.getElementById('withdrawSectionStatus');
    if (statusDiv) statusDiv.style.display = 'none';
    selectedWithdrawMethod = 'esewa';
    updateWithdrawMethodFields('esewa');
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === 'esewa') btn.classList.add('active');
    });
}
document.getElementById('submitWithdrawSectionBtn')?.addEventListener('click', async () => {
    if (!appState.currentUser) return;
    const amount = parseInt(document.getElementById('withdrawAmount')?.value);
    const statusDiv = document.getElementById('withdrawSectionStatus');
     if (!statusDiv) return;
    statusDiv.style.display = 'none';
    if (!amount || amount < 40) {
        statusDiv.textContent = 'Minimum withdrawal amount is NPR 40';
        statusDiv.className = 'alert alert-warning';
        statusDiv.style.display = 'block';
        return;
    }
    const totalBalance = getTotalBalance();
    if (totalBalance < amount) {
        statusDiv.textContent = 'Insufficient balance';
        statusDiv.className = 'alert alert-warning';
        statusDiv.style.display = 'block';
        return;
    }
    let accountDetails = '', accountName = '';
    if (selectedWithdrawMethod === 'bank') {
        const bankName = document.getElementById('withdrawBankName')?.value.trim();
        const accNumber = document.getElementById('withdrawAccountNumber')?.value.trim();
        accountName = document.getElementById('withdrawAccountName')?.value.trim();
        if (!bankName || !accNumber || !accountName) {
            statusDiv.textContent = 'Please fill all bank details';
            statusDiv.className = 'alert alert-warning';
            statusDiv.style.display = 'block';
            return;
        }
        accountDetails = `${bankName} - ${accNumber}`;
    } else {
        const walletNumber = document.getElementById('withdrawWalletNumber')?.value.trim();
        accountName = document.getElementById('withdrawAccountName')?.value.trim();
        if (!walletNumber || !accountName) {
            statusDiv.textContent = `Please fill ${selectedWithdrawMethod} number and name`;
            statusDiv.className = 'alert alert-warning';
            statusDiv.style.display = 'block';
            return;
        }
        accountDetails = walletNumber;
    }
    showLoader();
    try {
        const deducted = await deductFromWallet(amount, 'withdrawal', `Withdrawal request via ${selectedWithdrawMethod}`);
        if (!deducted) {
            statusDiv.textContent = 'Failed to process withdrawal';
            statusDiv.className = 'alert alert-danger';
            statusDiv.style.display = 'block';
            return;
        }
        await db.ref('withdrawals').push({
            userId: appState.currentUser.uid,
            userEmail: appState.currentUser.email,
            userName: appState.userProfile.displayName,
            method: selectedWithdrawMethod,
            accountDetails: accountDetails,
            accountName: accountName,
            amount: amount,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Withdrawal request submitted! Processed by 10:00 PM');
        showSection('wallet-section');
    } catch (error) {
        statusDiv.textContent = error.message;
        statusDiv.className = 'alert alert-danger';
        statusDiv.style.display = 'block';
    } finally { hideLoader(); }
});

// ==================== PROFILE & GAMING ====================
function loadProfileData() {
    if (!appState.currentUser) return;
    if (elements.profileName) elements.profileName.textContent = appState.userProfile.displayName || 'User';
    if (elements.profileEmail) elements.profileEmail.textContent = appState.currentUser.email;
    if (elements.profileMatches) elements.profileMatches.textContent = appState.userProfile.totalMatches || 0;
    if (elements.profileWins) elements.profileWins.textContent = appState.userProfile.wonMatches || 0;
    if (elements.profileEarnings) elements.profileEarnings.textContent = 'NPR ' + (appState.userProfile.totalEarnings || 0);
    const avatar = appState.userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(appState.userProfile.displayName || 'User')}&background=ffd700&color=000&size=80`;
    if (elements.profileAvatar) elements.profileAvatar.src = avatar;
    updateGamingProfileDisplay();
    loadMatchHistory();
    loadComplaintTournaments(); // populate complaint dropdown
}
function updateGamingProfileDisplay() {
    const g = appState.userProfile.gaming || {};
    document.getElementById('ffName').textContent = g.ffName || '-';
    document.getElementById('ffUid').textContent = g.ffUid || '-';
    document.getElementById('pubgName').textContent = g.pubgName || '-';
    document.getElementById('pubgUid').textContent = g.pubgUid || '-';
    document.getElementById('mlName').textContent = g.mlName || '-';
    document.getElementById('mlUid').textContent = g.mlUid || '-';
    document.getElementById('codName').textContent = g.codName || '-';
    document.getElementById('codUid').textContent = g.codUid || '-';
}
document.getElementById('editGamingProfileBtn')?.addEventListener('click', () => {
    const profile = appState.userProfile.gaming || {};
    document.getElementById('ffNameInput').value = profile.ffName || '';
    document.getElementById('ffUidInput').value = profile.ffUid || '';
    document.getElementById('pubgNameInput').value = profile.pubgName || '';
    document.getElementById('pubgUidInput').value = profile.pubgUid || '';
    document.getElementById('mlNameInput').value = profile.mlName || '';
    document.getElementById('mlUidInput').value = profile.mlUid || '';
    document.getElementById('codNameInput').value = profile.codName || '';
    document.getElementById('codUidInput').value = profile.codUid || '';
    new bootstrap.Modal(document.getElementById('gamingProfileModal')).show();
});
document.getElementById('saveGamingProfileBtn')?.addEventListener('click', async () => {
    const gaming = {
        ffName: document.getElementById('ffNameInput').value,
        ffUid: document.getElementById('ffUidInput').value,
        pubgName: document.getElementById('pubgNameInput').value,
        pubgUid: document.getElementById('pubgUidInput').value,
        mlName: document.getElementById('mlNameInput').value,
        mlUid: document.getElementById('mlUidInput').value,
        codName: document.getElementById('codNameInput').value,
        codUid: document.getElementById('codUidInput').value,
    };
    await db.ref(`users/${appState.currentUser.uid}/gaming`).set(gaming);
    appState.userProfile.gaming = gaming;
    updateGamingProfileDisplay();
    showToast('Gaming profile saved');
    bootstrap.Modal.getInstance(document.getElementById('gamingProfileModal')).hide();
});
  // ==================== COMPLAINT SYSTEM ====================
async function loadComplaintTournaments() {
    if (!appState.currentUser) return;
    const select = document.getElementById('complaintTournament');
    if (!select) return;
    select.innerHTML = '<option value="">Choose tournament...</option>';
    const joined = appState.userProfile.joinedTournaments || {};
    for (const [id] of Object.entries(joined)) {
        const snap = await db.ref(`tournaments/${id}`).once('value');
        const t = snap.val();
        if (t) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${t.name} (${t.game}) - ${new Date(t.matchDate).toLocaleDateString()}`;
            select.appendChild(option);
        }
    }
}

// Setup complaint file upload
setupUpload('complaintUploadArea', 'complaintFileInput', 'complaintPreview', 'complaintPreviewContainer', 'removeComplaintBtn');

document.getElementById('complaintForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!appState.currentUser) { showToast('Login first', 'error'); return; }

    const tournamentId = document.getElementById('complaintTournament').value;
    const category = document.getElementById('complaintCategory').value;
    const description = document.getElementById('complaintDesc').value;
    const fileInput = document.getElementById('complaintFileInput');
    let screenshot = null;

    if (!tournamentId || !category || !description) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            screenshot = ev.target.result;
            await submitComplaint(tournamentId, category, description, screenshot);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await submitComplaint(tournamentId, category, description, null);
    }
});

async function submitComplaint(tournamentId, category, description, screenshot) {
    showLoader('Submitting complaint...');
    try {
        await db.ref('complaints').push({
            userId: appState.currentUser.uid,
            userName: appState.userProfile.displayName,
            tournamentId,
            category,
            description,
            screenshot: screenshot || null,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Complaint submitted successfully!');
        document.getElementById('complaintForm').reset();
        document.getElementById('complaintPreviewContainer').style.display = 'none';
        document.getElementById('complaintUploadArea').style.display = 'block';
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}
// ==================== RESULT SUBMISSION ====================
async function loadResultMatches() {
    if (!appState.currentUser) return;
    const select = document.getElementById('resultMatchSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select your match</option>';
    const joined = appState.userProfile.joinedTournaments || {};
    for (const [id] of Object.entries(joined)) {
        const snap = await db.ref(`tournaments/${id}`).once('value');
        const t = snap.val();
        if (t && t.status === 'ongoing' && !t.winnerId) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${t.name} (${t.game})`;
            select.appendChild(option);
        }
    }
}
document.getElementById('winBtn')?.addEventListener('click', async () => {
    const matchId = document.getElementById('resultMatchSelect')?.value;
    if (!matchId) { showToast('Select a match', 'error'); return; }
    const fileInput = document.getElementById('resultFileInput');
    if (!fileInput || !fileInput.files[0]) { showToast('Upload winning screenshot', 'error'); return; }
    showLoader('Submitting result...');
    try {
        const file = fileInput.files[0];
        if (file.size < 102400) { showToast('Screenshot too small, please upload a clearer image', 'error'); return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            await db.ref('results').push({
                matchId,
                userId: appState.currentUser.uid,
                userName: appState.userProfile.displayName,
                result: 'win',
                screenshot: e.target.result,
                status: 'pending',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            showToast('Result submitted, awaiting admin verification');
            fileInput.value = '';
            const preview = document.getElementById('resultPreview');
            const uploadArea = document.getElementById('resultUploadArea');
            const previewContainer = document.getElementById('resultPreviewContainer');
            if (preview) preview.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'block';
            if (previewContainer) previewContainer.style.display = 'none';
            showSection('home-section');
        };
        reader.readAsDataURL(file);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
});
document.getElementById('lostBtn')?.addEventListener('click', () => {
    showToast('If you lost, you can rate your opponent from the profile.', 'info');
});

// ==================== FILE UPLOAD HELPER ====================
function setupUpload(areaId, inputId, previewId, containerId, removeBtnId) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const container = document.getElementById(containerId);
    const removeBtn = document.getElementById(removeBtnId);
    if (!area || !input || !preview) return;
    area.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                area.style.display = 'none';
                if (container) container.style.display = 'block';
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            input.value = '';
            preview.src = '';
            preview.style.display = 'none';
            area.style.display = 'block';
            if (container) container.style.display = 'none';
        });
    }
}
setupUpload('resultUploadArea', 'resultFileInput', 'resultPreview', 'resultPreviewContainer', 'removeResultBtn');
setupUpload('complaintUploadArea', 'complaintFileInput', 'complaintPreview', 'complaintPreviewContainer', 'removeComplaintBtn');

// ==================== ADD MONEY WITH QR ====================
document.getElementById('addMoneyBtn')?.addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('addMoneyModal'));
    modal.show();
    document.getElementById('addAmount').value = '';
    document.getElementById('qrContainer').style.display = 'none';
    document.getElementById('paymentFileInput').value = '';
    document.getElementById('paymentPreviewContainer').style.display = 'none';
    document.getElementById('paymentUploadArea').style.display = 'block';
    if (qrCodeInstance) qrCodeInstance.clear();
});
let qrCodeInstance = null;
document.getElementById('generateQrBtn')?.addEventListener('click', function() {
    const amount = document.getElementById('addAmount').value;
    if (!amount || amount < 10 || amount > 1000) {
        showToast('Please enter a valid amount between 10 and 10000', 'error');
        return;
    }
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.style.display = 'block';
    const upiId = 'tournament@bank';
    const payUrl = `upi://pay?pa=${upiId}&pn=AdproTournament&am=${amount}&cu=NPR`;
    if (qrCodeInstance) qrCodeInstance.clear();
    qrCodeInstance = new QRCode(document.getElementById('qrCode'), { text: payUrl, width: 200, height: 200 });
});
setupUpload('paymentUploadArea', 'paymentFileInput', 'paymentPreview', 'paymentPreviewContainer', 'removePaymentBtn');
document.getElementById('submitAddMoneyBtn')?.addEventListener('click', async () => {
    const amount = document.getElementById('addAmount').value;
    const fileInput = document.getElementById('paymentFileInput');
    if (!amount || amount < 10) { showToast('Enter a valid amount (min NPR 10)', 'error'); return; }
    if (!fileInput.files[0]) { showToast('Upload payment screenshot', 'error'); return; }
    showLoader('Submitting payment...');
    const reader = new FileReader();
    reader.onload = async (e) => {
        await db.ref('payments').push({
            userId: appState.currentUser.uid,
            userName: appState.userProfile.displayName,
            amount: parseFloat(amount),
            screenshot: e.target.result,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Payment submitted for verification');
        bootstrap.Modal.getInstance(document.getElementById('addMoneyModal')).hide();
        document.getElementById('addAmount').value = '';
        fileInput.value = '';
        document.getElementById('qrContainer').style.display = 'none';
        hideLoader();
    };
    reader.readAsDataURL(fileInput.files[0]);
});

// ==================== ADMIN PANEL (results/payments/reports/complaints) ====================
async function loadAdminResults() {
    if (!appState.currentUser || appState.userProfile.role !== 'admin') return;
    const snap = await db.ref('results').once('value');
    const results = snap.val() || {};
    let html = '';
    for (const [id, r] of Object.entries(results)) {
        if (r.status === 'pending') {
            html += `
                <div class="border-bottom p-2" data-id="${id}">
                    <p><strong>${r.userName}</strong> claims win in match ${r.matchId}</p>
                    <img src="${r.screenshot}" style="max-width:100%; max-height:200px;" class="rounded mb-2">
                    <div class="d-flex gap-2">
                        <button class="btn-custom btn-custom-success btn-sm approve-result" data-id="${id}" data-user="${r.userId}" data-match="${r.matchId}">Approve</button>
                        <button class="btn-custom btn-custom-danger btn-sm reject-result" data-id="${id}">Reject</button>
                    </div>
                    <div class="reject-reason mt-2" style="display:none;">
                        <input type="text" class="form-control form-control-sm" placeholder="Reason for rejection">
                        <button class="btn-custom btn-custom-danger btn-sm mt-1 submit-reject" data-id="${id}">Submit</button>
                    </div>
                </div>
            `;
        }
    }
    if (elements.adminResultsList) elements.adminResultsList.innerHTML = html || '<p class="text-secondary">No pending results</p>';

    document.querySelectorAll('.approve-result').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const resultId = e.target.dataset.id;
            const userId = e.target.dataset.user;
            const matchId = e.target.dataset.match;
            await approveResult(resultId, userId, matchId);
        });
    });
    document.querySelectorAll('.reject-result').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const div = e.target.closest('div').parentNode.querySelector('.reject-reason');
            div.style.display = div.style.display === 'none' ? 'block' : 'none';
        });
    });
    document.querySelectorAll('.submit-reject').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const resultId = e.target.dataset.id;
            const reasonInput = e.target.closest('.reject-reason').querySelector('input');
            const reason = reasonInput.value;
            if (!reason) return showToast('Enter reason', 'error');
            await rejectResult(resultId, reason);
        });
    });
}
async function approveResult(resultId, userId, matchId) {
    showLoader('Approving...');
    const matchSnap = await db.ref(`tournaments/${matchId}`).once('value');
    const match = matchSnap.val();
    if (!match) return showToast('Match not found', 'error');
    const totalPool = match.entryFee * (match.maxPlayers || 2);
    const prize = totalPool * 0.95;
    await db.ref(`users/${userId}/winningCash`).transaction(v => (v || 0) + prize);
    await db.ref(`users/${userId}/totalEarnings`).transaction(v => (v || 0) + prize);
    await db.ref(`transactions/${userId}`).push({
        type: 'match_win',
        amount: prize,
        description: `Won match ${match.name}`,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    await db.ref(`tournaments/${matchId}`).update({ status: 'completed', winnerId: userId });
    await db.ref(`results/${resultId}`).remove();
    showToast('Result approved, prize credited');
    loadAdminResults();
    hideLoader();
}
async function rejectResult(resultId, reason) {
    showLoader();
    await db.ref(`results/${resultId}`).update({ status: 'rejected', reason });
    showToast('Result rejected');
    loadAdminResults();
    hideLoader();
}
async function loadAdminPayments() {
    if (!appState.currentUser || appState.userProfile.role !== 'admin') return;
    const snap = await db.ref('payments').once('value');
    const payments = snap.val() || {};
    let html = '';
    for (const [id, p] of Object.entries(payments)) {
        if (p.status === 'pending') {
            html += `
                <div class="border-bottom p-2" data-id="${id}">
                    <p><strong>${p.userName}</strong> added NPR ${p.amount}</p>
                    <img src="${p.screenshot}" style="max-width:100%; max-height:200px;" class="rounded mb-2">
                    <div class="d-flex gap-2">
                        <button class="btn-custom btn-custom-success btn-sm approve-payment" data-id="${id}" data-user="${p.userId}" data-amount="${p.amount}">Approve</button>
                        <button class="btn-custom btn-custom-danger btn-sm reject-payment" data-id="${id}">Reject</button>
                    </div>
                </div>
            `;
        }
    }
    if (elements.adminPaymentsList) elements.adminPaymentsList.innerHTML = html || '<p class="text-secondary">No pending payments</p>';

    document.querySelectorAll('.approve-payment').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const paymentId = e.target.dataset.id;
            const userId = e.target.dataset.user;
            const amount = parseFloat(e.target.dataset.amount);
            await approvePayment(paymentId, userId, amount);
        });
    });
    document.querySelectorAll('.reject-payment').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const paymentId = e.target.dataset.id;
            await rejectPayment(paymentId);
        });
    });
}
async function approvePayment(paymentId, userId, amount) {
    showLoader('Approving payment...');
    await db.ref(`users/${userId}/depositBalance`).transaction(v => (v || 0) + amount);
    await db.ref(`transactions/${userId}`).push({
        type: 'deposit',
        amount: amount,
        description: 'Money added via payment',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    await db.ref(`payments/${paymentId}`).remove();
    showToast('Payment approved');
    loadAdminPayments();
    hideLoader();
}
async function rejectPayment(paymentId) {
    showLoader();
    await db.ref(`payments/${paymentId}`).update({ status: 'rejected' });
    showToast('Payment rejected');
    loadAdminPayments();
    hideLoader();
}

async function loadAdminComplaints() {
    if (!appState.currentUser || appState.userProfile.role !== 'admin') return;
    const snap = await db.ref('complaints').once('value');
    const complaints = snap.val() || {};
    let html = '';
    for (const [id, c] of Object.entries(complaints)) {
        if (c.status === 'pending') {
            html += `
                <div class="border-bottom p-2" data-id="${id}">
                    <p><strong>${c.userName}</strong> reported issue in match ${c.tournamentId}</p>
                    <p>Category: ${c.category}</p>
                    <p>Description: ${c.description}</p>
                    ${c.screenshot ? `<img src="${c.screenshot}" style="max-width:100%; max-height:200px;" class="rounded mb-2">` : ''}
                    <div class="d-flex gap-2">
                        <button class="btn-custom btn-custom-success btn-sm resolve-complaint" data-id="${id}">Resolve</button>
                    </div>
                </div>
            `;
        }
    }
    if (elements.adminComplaintsList) elements.adminComplaintsList.innerHTML = html || '<p class="text-secondary">No pending complaints</p>';

    document.querySelectorAll('.resolve-complaint').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await db.ref(`complaints/${id}`).update({ status: 'resolved' });
            showToast('Complaint resolved');
            loadAdminComplaints();
        });
    });
}
// ==================== TOURNAMENTS / LEADERBOARD TOGGLE ====================
document.getElementById('showMatchesBtn')?.addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('showLeaderboardBtn').classList.remove('active');
    document.getElementById('tournamentsContainer').style.display = 'block';
    document.getElementById('leaderboardContainer').style.display = 'none';
    document.getElementById('tournamentStatusFilters').style.display = 'flex';
    const status = document.querySelector('[data-status].active')?.dataset.status || 'upcoming';
    loadTournaments(status);
});
document.getElementById('showLeaderboardBtn')?.addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('showMatchesBtn').classList.remove('active');
    document.getElementById('tournamentsContainer').style.display = 'none';
    document.getElementById('leaderboardContainer').style.display = 'block';
    document.getElementById('tournamentStatusFilters').style.display = 'none';
    loadLeaderboard('weekly');
});

// ==================== LEADERBOARD ====================
async function loadLeaderboard(period = 'weekly') {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const leaderboard = Object.entries(users)
        .map(([uid, u]) => ({ uid, name: u.displayName, earnings: u.totalEarnings || 0 }))
        .sort((a,b) => b.earnings - a.earnings)
        .slice(0, 10);
    let html = '';
    leaderboard.forEach((item, idx) => {
        html += `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${idx+1}</div>
                <div class="leaderboard-name">${item.name}</div>
                <div class="leaderboard-earnings">NPR ${item.earnings}</div>
            </div>
        `;
    });
    elements.leaderboardContainer.innerHTML = html || '<p class="text-secondary">No data</p>';
}

// ==================== CHAT ====================
let currentChatMatchId = null;
function openChat(matchId) {
    currentChatMatchId = matchId;
    document.getElementById('chatTitle').textContent = `Match Chat - ${matchId}`;
    loadChatMessages(matchId);
  });

// ==================== NOTIFICATIONS ====================
function requestNotificationPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}
function sendNotification(title, body) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
    }
}
setInterval(() => {
    if (!appState.currentUser) return;
    // optional notification logic
}, 60000);

// ==================== MATCH HISTORY ====================
async function loadMatchHistory() {
    if (!appState.currentUser) return;
    const joined = appState.userProfile.joinedTournaments || {};
    let historyHtml = '';
    for (const [id] of Object.entries(joined)) {
        const snap = await db.ref(`tournaments/${id}`).once('value');
        const t = snap.val();
        if (t && t.status === 'completed') {
            const won = t.winnerId === appState.currentUser.uid;
            historyHtml += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border-bottom">
                    <div><small>${t.name}</small><div class="text-secondary small">${formatDate(t.completedAt)}</div></div>
                    <span class="${won ? 'text-success' : 'text-danger'}">${won ? 'Won' : 'Lost'}</span>
                </div>
            `;
        }
    }
    elements.matchHistoryList.innerHTML = historyHtml || '<p class="text-secondary text-center">No completed matches</p>';
    const totalMatches = appState.userProfile.totalMatches || 0;
    const wins = appState.userProfile.wonMatches || 0;
    const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;
    elements.winRate.textContent = winRate + '%';
    elements.totalEarningsStat.textContent = 'NPR ' + (appState.userProfile.totalEarnings || 0);
}

// ==================== RATING ====================
function openRatingModal(matchId, opponentId) {
    document.getElementById('rateMatchId').value = matchId;
    document.getElementById('rateUserId').value = opponentId;
    document.getElementById('ratingValue').value = 0;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active', 'bi-star-fill'));
    document.querySelectorAll('.star').forEach(s => s.classList.add('bi-star'));
    new bootstrap.Modal(document.getElementById('rateModal')).show();
}
document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', function() {
        const val = this.dataset.star;
        document.getElementById('ratingValue').value = val;
        document.querySelectorAll('.star').forEach(s => {
            s.classList.remove('active', 'bi-star-fill');
            s.classList.add('bi-star');
        });
        for (let i = 1; i <= val; i++) {
            const s = document.querySelector(`.star[data-star="${i}"]`);
            s.classList.add('active', 'bi-star-fill');
            s.classList.remove('bi-star');
        }
    });
});
document.getElementById('submitRatingBtn')?.addEventListener('click', async () => {
    const matchId = document.getElementById('rateMatchId').value;
    const userId = document.getElementById('rateUserId').value;
    const rating = parseInt(document.getElementById('ratingValue').value);
    if (rating < 1) return showToast('Select a rating', 'error');
    await db.ref(`ratings/${userId}`).push({
        matchId,
        raterId: appState.currentUser.uid,
        rating,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    showToast('Rating submitted');
    bootstrap.Modal.getInstance(document.getElementById('rateModal')).hide();
});

// ==================== REPORT ====================
function openReportModal(matchId, userId) {
    document.getElementById('reportMatchId').value = matchId;
    document.getElementById('reportUserId').value = userId;
    new bootstrap.Modal(document.getElementById('reportModal')).show();
}
document.getElementById('submitReportBtn')?.addEventListener('click', async () => {
    const matchId = document.getElementById('reportMatchId').value;
    const userId = document.getElementById('reportUserId').value;
    const reason = document.getElementById('reportReason').value;
    if (!reason) return showToast('Enter reason', 'error');
    await db.ref('reports').push({
        matchId,
        reportedUserId: userId,
        reporterId: appState.currentUser.uid,
        reason,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    showToast('Report submitted');
    bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
});

// ==================== NAVIGATION ====================
elements.navItems.forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
});
document.getElementById('createMatchBtn')?.addEventListener('click', () => showSection('host-section'));
document.getElementById('joinBRBtn')?.addEventListener('click', () => showSection('br-section'));
document.getElementById('rulesBtn')?.addEventListener('click', () => showSection('rules-section'));
document.getElementById('termsBtn')?.addEventListener('click', () => showSection('terms-section'));
document.getElementById('backToProfileBtn')?.addEventListener('click', () => showSection('profile-section'));
document.getElementById('backToProfileFromTerms')?.addEventListener('click', () => showSection('profile-section'));
document.getElementById('backFromWithdrawBtn')?.addEventListener('click', () => showSection('wallet-section'));
document.getElementById('withdrawBtn')?.addEventListener('click', () => showSection('withdraw-section'));

// ==================== STATUS FILTERS ====================
document.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTournaments(btn.dataset.status);
    });
});

// ==================== PASSWORD TOGGLE ====================
function setupPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input && toggle) {
        toggle.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }
}
setupPasswordToggle('loginPassword', 'toggleLoginPassword');
setupPasswordToggle('signupPassword', 'toggleSignupPassword');

// ==================== TOGGLE FORMS ====================
document.getElementById('showSignupLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('signupFormContainer').style.display = 'block';
});
document.getElementById('showLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signupFormContainer').style.display = 'none';
    document.getElementById('loginFormContainer').style.display = 'block';
});

// ==================== LOGIN ====================
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const status = document.getElementById('loginStatus');
    showLoader('Logging in...');
    if (status) status.style.display = 'none';
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        hideLoader();
        if (status) {
            status.textContent = error.message;
            status.className = 'alert alert-danger';
            status.style.display = 'block';
        }
    }
});

// ==================== SIGNUP ====================
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const referral = document.getElementById('signupReferral').value;
    const status = document.getElementById('signupStatus');
    showLoader('Creating account...');
    if (status) status.style.display = 'none';
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        let referredBy = null;
        if (referral) {
            const usersRef = db.ref('users');
            const snapshot = await usersRef.orderByChild('referralCode').equalTo(referral).once('value');
            if (snapshot.exists()) referredBy = Object.keys(snapshot.val())[0];
        }
        await db.ref(`users/${user.uid}`).set({
            uid: user.uid,
            displayName: name,
            email: email,
            depositBalance: 0,
            winningCash: 0,
            bonusCash: 5,
            referralCode: referralCode,
            referredBy: referredBy,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            totalMatches: 0,
            wonMatches: 0,
            totalEarnings: 0,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffd700&color=000&size=80`,
            status: 'active',
            role: 'user'
        });
        await db.ref(`transactions/${user.uid}`).push({
            type: 'welcome_bonus',
            amount: 5,
            description: 'Welcome bonus',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        if (referredBy) {
            await db.ref(`users/${referredBy}/bonusCash`).transaction((current) => (current || 0) + 10);
            await db.ref(`transactions/${referredBy}`).push({
                type: 'referral_bonus',
                amount: 10,
                description: 'Referral bonus from new user',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
        showToast('Account created! Welcome bonus NPR 5 added!');
    } catch (error) {
        hideLoader();
        if (status) {
            status.textContent = error.message;
            status.className = 'alert alert-danger';
            status.style.display = 'block';
        }
    }
});

// ==================== REFERRAL ====================
document.getElementById('referralBtn')?.addEventListener('click', () => {
    const codeDisplay = document.getElementById('referralCodeDisplay');
    if (codeDisplay) codeDisplay.value = appState.userProfile.referralCode || 'N/A';
    new bootstrap.Modal(document.getElementById('referralModal')).show();
});
document.getElementById('copyReferralBtn')?.addEventListener('click', () => {
    const code = document.getElementById('referralCodeDisplay');
    if (code) { code.select(); document.execCommand('copy'); showToast('Referral code copied!'); }
});

// ==================== LOGOUT ====================
document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOut());

// ==================== AUTH STATE ====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userSnap = await db.ref(`users/${user.uid}`).once('value');
        let userData = userSnap.val();
        if (!userData.role) {
            await db.ref(`users/${user.uid}/role`).set('user');
            userData.role = 'user';
        }
        if (userData && userData.status === 'banned') {
            await auth.signOut();
            showToast('Your account has been banned', 'error');
            showSection('login-section');
            return;
        }
        appState.currentUser = user;
        appState.userProfile = userData || {};
        if (elements.headerGreeting) elements.headerGreeting.textContent = appState.userProfile.displayName || 'User';
        updateAllWalletDisplays();
        if (elements.headerWallet) elements.headerWallet.style.display = 'flex';
        if (userData.role === 'admin') {
            const nav = document.querySelector('.bottom-nav');
            if (!document.querySelector('.nav-item[data-section="admin-section"]')) {
                const adminItem = document.createElement('button');
                adminItem.className = 'nav-item';
                adminItem.dataset.section = 'admin-section';
                adminItem.innerHTML = '<i class="bi bi-shield-lock"></i><span>Admin</span>';
                nav.appendChild(adminItem);
                adminItem.addEventListener('click', () => showSection('admin-section'));
            }
            // Show admin create tournament card
            const createSection = document.getElementById('adminCreateTournamentSection');
            if (createSection) createSection.style.display = 'block';
        }
        // Remove old admin tournament node? We'll keep it but hide its card.
        const oldAdminCard = document.getElementById('adminTournamentCard');
        if (oldAdminCard) oldAdminCard.style.display = 'none';
        showSection('home-section');
    } else {
        appState.currentUser = null;
        appState.userProfile = {};
        if (elements.headerGreeting) elements.headerGreeting.textContent = 'Guest';
        if (elements.headerBalance) elements.headerBalance.textContent = '0';
        if (elements.headerWallet) elements.headerWallet.style.display = 'none';
        showSection('login-section');
    }
    hideLoader();
});
// ==================== AUTO-REFRESH ====================
setInterval(() => {
    if (!appState.currentUser) return;
    switch (appState.currentSection) {
        case 'home-section': loadHomeData(); break;
        case 'tournaments-section': {
            const status = document.querySelector('[data-status].active')?.dataset.status || 'upcoming';
            loadTournaments(status);
            break;
        }
        case 'game-tournaments-section':
            if (appState.currentGameFilter) loadGameTournaments(appState.currentGameFilter);
            break;
        case 'br-section': {
            const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
            loadAdminTournaments(activeTab);
            break;
        }
        case 'wallet-section': loadWalletData(); break;
        case 'admin-section':
            loadAdminResults();
            loadAdminPayments();
            loadAdminComplaints();
            break;
    }
}, 10000);

// ==================== SWIPER ====================
new Swiper('#heroSlider', { loop: true, autoplay: { delay: 3000 }, pagination: { el: '.swiper-pagination' } });

// ==================== REQUEST NOTIFICATION PERMISSION ====================
requestNotificationPermission();
