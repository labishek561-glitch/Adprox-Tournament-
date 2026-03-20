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
    tournamentToDelete: null,
    deleteWithRefund: false
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
    const text = document.getElementById(elementId)?.innerText || elementId;
    navigator.clipboard?.writeText(text).then(() => {
        showToast('Copied!');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
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
            const dbUpdates = { ...current };
            if (type === 'winning') dbUpdates.winningCash = (Number(current.winningCash) || 0) + amount;
            else if (type === 'deposit') dbUpdates.depositBalance = (Number(current.depositBalance) || 0) + amount;
            else if (type === 'bonus') dbUpdates.bonusCash = (Number(current.bonusCash) || 0) + amount;
            return dbUpdates;
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

// ==================== NOTIFICATION SYSTEM ====================
async function sendNotification(uid, title, message) {
    if (!uid) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
            new Notification(title, { body: message });
        } catch (e) {
            console.warn('Browser notification failed', e);
        }
    }
    await db.ref(`notifications/${uid}`).push({
        title,
        message,
        read: false,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}
function requestNotificationPermission() {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

async function userHasActiveMatch() {
    if (!appState.currentUser) return false;
    const uid = appState.currentUser.uid;
    const tournamentsSnap = await db.ref('tournaments')
        .orderByChild('status')
        .once('value');
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
            loadAdminTournaments('upcoming', 'all');
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

// ==================== RENDER TOURNAMENT CARD (for players) ====================
function renderTournamentCard(id, t) {
    const registeredCount = t.registeredPlayers ? Object.keys(t.registeredPlayers).length : 0;
    const maxPlayers = t.maxPlayers || 2;
    const isFull = registeredCount >= maxPlayers;

    const joined = appState.currentUser && t.registeredPlayers && t.registeredPlayers[appState.currentUser.uid];
    const requested = appState.currentUser && t.joinRequests && t.joinRequests[appState.currentUser.uid];
    const isHost = t.hostId === appState.currentUser?.uid;
    const isAdmin = appState.userProfile?.role === 'admin';

    const now = Date.now();
    const matchDate = t.matchDate ? new Date(t.matchDate).getTime() : null;

    // Hide card from non-joined users if match start time has passed
    if (t.status === 'upcoming' && matchDate && now > matchDate && !joined && !isHost) {
        return ''; // don't show this card
    }

    let showJoin = false;
    if (!joined && !isHost && t.status === 'upcoming' && !isFull && !requested) {
        if (!matchDate || now < matchDate) {
            showJoin = true;
        }
    }

    let requestMessage = '';
    if (requested) {
        requestMessage = `<p class="small text-warning mt-1"><i class="bi bi-hourglass-split"></i> Request sent, waiting for host approval.</p>`;
    }

    let revealNote = '';
    if (t.isAdminTournament && t.status === 'upcoming' && !t.showIdPass && t.matchDate) {
        const matchTime = new Date(t.matchDate).getTime();
        const diffMinutes = Math.floor((matchTime - now) / 60000);
        if (diffMinutes > 2) {
            revealNote = `<p class="small text-info mt-1"><i class="bi bi-info-circle"></i> Room ID & password will appear 2 minutes before match start.</p>`;
        } else if (diffMinutes <= 2 && diffMinutes > 0) {
            revealNote = `<p class="small text-warning mt-1"><i class="bi bi-clock"></i> Room details will appear any moment...</p>`;
        }
    }

    let roomHtml = '';
    if (joined && t.showIdPass && t.roomId && t.roomPassword) {
        roomHtml = `
            <div class="room-details mt-2 p-2" style="background: var(--primary-bg); border-radius: 8px;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-accent">Room ID:</span>
                    <span class="text-white fw-bold">${t.roomId}</span>
                    <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.roomId}')">Copy</button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-accent">Password:</span>
                    <span class="text-white fw-bold">${t.roomPassword}</span>
                    <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.roomPassword}')">Copy</button>
                </div>
            </div>
        `;
    }

    let provideButton = '';
    if ((isHost || (t.isAdminTournament && isAdmin)) && t.status === 'upcoming' && !t.showIdPass && registeredCount > 0) {
        provideButton = `<button class="btn-custom btn-custom-primary btn-sm provide-room mt-2" data-id="${id}">Provide Room Details</button>`;
    }

    let prizeDisplay = 'N/A';
    let distributionNote = '';
    if (t.isAdminTournament) {
        if (t.distributionType) {
            distributionNote = `<div class="distribution-note small text-accent mt-1"><i class="bi bi-trophy"></i> ${t.distributionType}</div>`;
        }
        if (t.prizePool) {
            prizeDisplay = formatCurrency(t.prizePool);
        } else {
            prizeDisplay = formatCurrency((t.entryFee || 0) * (t.maxPlayers || 2));
        }
    } else {
        const totalPool = (t.entryFee || 0) * (t.maxPlayers || 2);
        const prize = totalPool - totalPool * 0.05;
        prizeDisplay = formatCurrency(prize);
    }

    let slotDisplay = '';
    if (joined && t.isAdminTournament && t.registeredPlayers[appState.currentUser.uid]?.slot) {
        const slot = t.registeredPlayers[appState.currentUser.uid].slot;
        slotDisplay = `<div class="badge bg-warning text-dark mt-1 mb-2"><i class="bi bi-hash"></i> Your Slot: #${slot}</div>`;
    }

    const countdownId = `countdown-${id}`;
    const matchDateStr = t.matchDate ? new Date(t.matchDate).toLocaleString() : 'TBD';

    let resultButtons = '';
    if (joined && t.status === 'ongoing' && !t.winnerId && !t.results) {
        resultButtons = `
            <button class="btn-custom btn-custom-success flex-grow-1 claim-win" data-id="${id}">I Won</button>
            <button class="btn-custom btn-custom-danger flex-grow-1 claim-lost" data-id="${id}">I Lost</button>
        `;
    }

    let reportButton = '';
    if ((joined || isHost) && (t.status === 'upcoming' || t.status === 'ongoing')) {
        reportButton = `<button class="btn-custom btn-custom-secondary btn-sm report-match" data-id="${id}" data-opponent="${getOpponentId(t)}"><i class="bi bi-flag"></i> Report</button>`;
    }

    const chatButton = `<button class="btn-custom btn-custom-secondary btn-sm chat-tournament" data-id="${id}"><i class="bi bi-chat"></i> Chat</button>`;

    let hostControls = '';
    if (!t.isAdminTournament && isHost && t.status === 'upcoming') {
        hostControls = `
            <div class="mt-2 d-flex gap-2">
                <button class="btn-custom btn-custom-secondary btn-sm edit-tournament" data-id="${id}"><i class="bi bi-pencil"></i> Edit</button>
                <button class="btn-custom btn-custom-danger btn-sm delete-tournament" data-id="${id}"><i class="bi bi-trash"></i> Delete</button>
            </div>
        `;
    }

    let teamSizeDisplay = '';
    if (t.teamSize) {
        const sizeNames = {1:'Solo', 2:'Duo', 4:'Squad'};
        teamSizeDisplay = `<span class="badge bg-secondary me-1">${sizeNames[t.teamSize] || t.teamSize}</span>`;
    }
    let modeDisplay = '';
    if (t.mode) {
        modeDisplay = `<span class="badge bg-secondary me-1">${t.mode}</span>`;
    } else if (t.gameOptions) {
        if (t.game === 'freefire') modeDisplay = `<span class="badge bg-secondary me-1">${t.gameOptions.playerFormat || ''}</span>`;
        else if (t.game === 'pubg') modeDisplay = `<span class="badge bg-secondary me-1">${t.gameOptions.matchType || ''}</span>`;
        else if (t.game === 'cod') modeDisplay = `<span class="badge bg-secondary me-1">${t.gameOptions.gameMode || ''}</span>`;
        else if (t.game === 'mobilelegend') modeDisplay = `<span class="badge bg-secondary me-1">${t.gameOptions.gameMode || ''}</span>`;
    }
    
    const countdownHtml = (!t.isAdminTournament && t.status === 'upcoming') ? `<div class="countdown" id="${countdownId}"></div>` : '';

    let pointsHtml = '';
    if (t.isAdminTournament && (t.killPoints || t.survivalPoints || t.topWinners)) {
        pointsHtml = `<div class="small text-info mt-1">`;
        if (t.killPoints) pointsHtml += `<span class="me-2"><i class="bi bi-bullseye"></i> Per Kill: ${formatCurrency(t.killPoints)}</span>`;
        if (t.survivalPoints) pointsHtml += `<span class="me-2"><i class="bi bi-shield-shaded"></i> Survival: ${formatCurrency(t.survivalPoints)}</span>`;
        if (t.topWinners) pointsHtml += `<span><i class="bi bi-trophy"></i> Top ${t.topWinners} Winners</span>`;
        pointsHtml += `</div>`;
    }

    const gameOptionsHtml = renderGameOptions(t);

    // Get player's own gaming UID if joined
    let ownGameUidHtml = '';
    if (joined && !t.isAdminTournament) {
        const game = t.game;
        const gameUidField = {
            freefire: 'ffUid',
            pubg: 'pubgUid',
            cod: 'codUid',
            mobilelegend: 'mlUid'
        }[game];
        const gameUid = appState.userProfile.gaming?.[gameUidField] || '';
        if (gameUid) {
            ownGameUidHtml = `<p class="small text-secondary mb-1"><i class="bi bi-person-badge"></i> Your Gaming UID: ${gameUid} <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${gameUid}')">Copy</button></p>`;
        }
    }

    return `
        <div class="tournament-card" data-id="${id}" data-created="${t.createdAt || Date.now()}" data-fullsince="${t.fullSince || ''}">
            <div class="tournament-header">
                <span class="tournament-badge">${t.game || 'Game'}</span>
                <span class="status-badge ${t.status === 'ongoing' ? 'status-live' : t.status === 'completed' ? 'status-completed' : 'status-waiting'}">${t.status}</span>
            </div>
            <img src="https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png" class="tournament-image" style="height: 120px; object-fit: contain; margin-bottom: 10px;">
            <h6 class="fw-bold">${t.name || 'Match'}</h6>
            <div class="d-flex flex-wrap gap-1 mb-2">
                ${teamSizeDisplay}
                ${modeDisplay}
                ${distributionNote}
            </div>
            ${!t.isAdminTournament ? `
            <div class="host-info">
                <img src="${t.hostAvatar || 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png'}" class="host-avatar">
                <div class="host-details">
                    <div class="host-name">${t.hostName || 'Host'}</div>
                    <div class="host-label">UID: ${t.hostUid || 'N/A'} <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.hostUid}')">Copy</button></div>
                </div>
            </div>
            ` : ''}
            ${gameOptionsHtml}
            <p class="small text-secondary mb-1">📅 ${matchDateStr}</p>
            <p class="small text-secondary mb-1">Entry: ${formatCurrency(t.entryFee)}</p>
            <p class="prize-text mb-2"><strong>🏆 Prize: ${prizeDisplay}</strong></p>
            ${pointsHtml}
            <p class="small text-secondary mb-2">
                Teams: ${registeredCount}/${maxPlayers}
                ${isFull ? '<span class="match-full-badge ms-2">Full</span>' : ''}
            </p>
            ${slotDisplay}
            ${ownGameUidHtml}
            ${requestMessage}
            ${revealNote}
            ${countdownHtml}
            ${roomHtml}
            ${provideButton}
            <div class="d-flex gap-2 mt-2">
                ${chatButton}
                ${showJoin ? '<button class="btn-custom btn-custom-accent flex-grow-1 request-join" data-id="' + id + '">Request to Join (NPR ' + t.entryFee + ')</button>' : ''}
                ${resultButtons}
                ${reportButton}
                ${isFull && t.status === 'upcoming' ? '<button class="btn-custom btn-custom-secondary flex-grow-1" disabled>Match Full</button>' : ''}
            </div>
            ${hostControls}
        </div>
    `;
}
// Helper to get opponent ID from tournament (for reporting)
function getOpponentId(t) {
    if (!appState.currentUser) return null;
    const players = t.registeredPlayers || {};
    if (t.hostId === appState.currentUser.uid) {
        const opponentId = Object.keys(players).find(uid => uid !== t.hostId);
        return opponentId || null;
    } else {
        return t.hostId;
    }
}

// ==================== RENDER HOSTED CARD (for host view) ====================
function renderHostedCard(id, t) {
    const registeredCount = t.registeredPlayers ? Object.keys(t.registeredPlayers).length : 0;
    const maxPlayers = t.maxPlayers || 2;
    const joinerId = Object.keys(t.registeredPlayers || {}).find(uid => uid !== t.hostId);
    const joiner = joinerId ? t.registeredPlayers[joinerId] : null;
    const totalPool = t.entryFee * maxPlayers;
    const prize = totalPool - (totalPool * 0.05);
    const showProvide = t.status === 'upcoming' && !t.showIdPass && registeredCount > 0;

    const requests = t.joinRequests || {};
    const requestCount = Object.keys(requests).length;

    let hostedRoomHtml = '';
    if (t.showIdPass && t.roomId && t.roomPassword) {
        hostedRoomHtml = `
            <div class="room-details mt-2 p-2" style="background: var(--primary-bg); border-radius: 8px;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-accent">Room ID:</span>
                    <span class="text-white fw-bold">${t.roomId}</span>
                    <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.roomId}')">Copy</button>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-accent">Password:</span>
                    <span class="text-white fw-bold">${t.roomPassword}</span>
                    <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.roomPassword}')">Copy</button>
                </div>
            </div>
        `;
    }

    const gameOptionsHtml = renderGameOptions(t);

    let teamSizeDisplay = '';
    if (t.teamSize) {
        const sizeNames = {1:'Solo', 2:'Duo', 4:'Squad'};
        teamSizeDisplay = `<span class="badge bg-secondary me-1">${sizeNames[t.teamSize] || t.teamSize}</span>`;
    }

    let requestsHtml = '';
    if (requestCount > 0) {
        requestsHtml = '<div class="mt-3"><h6>Join Requests</h6>';
        Object.entries(requests).forEach(([uid, req]) => {
            requestsHtml += `
                <div class="d-flex justify-content-between align-items-center p-2 mb-2" style="background: var(--primary-bg); border-radius: 8px;">
                    <div>
                        <strong>${req.name}</strong><br>
                        <small>UID: ${req.gameUid || req.uid} 
                            <button class="btn-custom btn-custom-secondary btn-sm ms-2" onclick="copyToClipboard('${req.gameUid || req.uid}')">Copy</button>
                        </small>
                    </div>
                    <div>
                        <button class="btn-custom btn-custom-success btn-sm me-1 approve-request" data-id="${id}" data-user="${uid}">Approve</button>
                        <button class="btn-custom btn-custom-danger btn-sm reject-request" data-id="${id}" data-user="${uid}">Reject</button>
                    </div>
                </div>
            `;
        });
        requestsHtml += '</div>';
    }

    // Display opponent's gaming UID if available
    let opponentDisplay = '';
    if (joiner) {
        const opponentGameUid = joiner.gameUid || joiner.uid;
        opponentDisplay = `
            <p class="small text-accent">
                Opponent: ${joiner.name} 
                <small>(UID: ${opponentGameUid}
                    <button class="btn-custom btn-custom-secondary btn-sm ms-2" onclick="copyToClipboard('${opponentGameUid}')">Copy</button>
                )</small>
            </p>`;
    }

    return `
        <div class="tournament-card" data-id="${id}">
            <img src="https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png" class="tournament-image">
            <h6>${t.name || 'Match'}</h6>
            <div class="host-info">
                <img src="${appState.userProfile.photoURL || 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png'}" class="host-avatar">
                <div class="host-details">
                    <div class="host-name">You</div>
                    <div class="host-label">UID: ${t.hostUid || 'N/A'} <button class="btn-custom btn-custom-secondary btn-sm" onclick="copyToClipboard('${t.hostUid}')">Copy</button></div>
                </div>
            </div>
            ${gameOptionsHtml}
            <p class="small text-secondary">Entry: ${formatCurrency(t.entryFee)} | Prize: ${formatCurrency(prize)}</p>
            <p class="small text-secondary">Teams: ${registeredCount}/${maxPlayers} ${teamSizeDisplay}</p>
            ${opponentDisplay}
            ${showProvide ? '<button class="btn-custom btn-custom-primary provide-room mt-2" data-id="' + id + '">Provide Room Details</button>' : ''}
            ${hostedRoomHtml}
            ${requestsHtml}
            <span class="status-badge ${t.status === 'ongoing' ? 'status-live' : 'status-waiting'} mt-2 d-inline-block">${t.status || 'upcoming'}</span>
        </div>
    `;
}

// ==================== LOAD FUNCTIONS ====================
async function loadGameTournaments(gameId) {
    if (!gameId) return;
    const snapshot = await db.ref('tournaments')
        .orderByChild('game')
        .equalTo(gameId)
        .once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.status !== 'completed') {
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
    const snapshot = await db.ref('tournaments')
        .orderByChild('status')
        .equalTo(status)
        .once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        html += renderTournamentCard(id, t);
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
    document.querySelectorAll('.request-join').forEach(btn => {
        btn.removeEventListener('click', requestJoinHandler);
        btn.addEventListener('click', requestJoinHandler);
    });
    document.querySelectorAll('.approve-request').forEach(btn => {
        btn.removeEventListener('click', approveRequestHandler);
        btn.addEventListener('click', approveRequestHandler);
    });
    document.querySelectorAll('.reject-request').forEach(btn => {
        btn.removeEventListener('click', rejectRequestHandler);
        btn.addEventListener('click', rejectRequestHandler);
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
    document.querySelectorAll('.report-match').forEach(btn => {
        btn.removeEventListener('click', reportMatchHandler);
        btn.addEventListener('click', reportMatchHandler);
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
async function requestJoinHandler(e) {
    const tournamentId = e.target.dataset.id;
    if (!appState.currentUser) { showToast('Login first', 'error'); return; }

    if (await userHasActiveMatch()) {
        showToast('You already have an active match. Please finish or delete it first.', 'error');
        return;
    }

    showLoader('Sending join request...');
    try {
        const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
        const t = snap.val();
        if (!t) { showToast('Tournament not found', 'error'); return; }
        if (t.hostId === appState.currentUser.uid) { showToast('You cannot join your own match', 'error'); return; }
        if (t.registeredPlayers && t.registeredPlayers[appState.currentUser.uid]) { showToast('Already joined', 'info'); return; }
        if (t.joinRequests && t.joinRequests[appState.currentUser.uid]) { showToast('Request already sent', 'info'); return; }
        const registeredCount = Object.keys(t.registeredPlayers || {}).length;
        const maxPlayers = t.maxPlayers || 2;
        if (registeredCount >= maxPlayers) { showToast('Match is full', 'error'); return; }

        // Get the gaming UID for this tournament's game
        const game = t.game;
        const gameUidField = {
            freefire: 'ffUid',
            pubg: 'pubgUid',
            cod: 'codUid',
            mobilelegend: 'mlUid'
        }[game];
        const gameUid = appState.userProfile.gaming?.[gameUidField] || '';

        // Create join request
        const requestData = {
            uid: appState.currentUser.uid,
            name: appState.userProfile.displayName,
            gameUid: gameUid,
            requestedAt: firebase.database.ServerValue.TIMESTAMP
        };
        await db.ref(`tournaments/${tournamentId}/joinRequests/${appState.currentUser.uid}`).set(requestData);

        showToast('Join request sent. Waiting for host approval.');
        loadHomeData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
}

async function approveRequestHandler(e) {
    const tournamentId = e.target.dataset.id;
    const userId = e.target.dataset.user;
    if (!tournamentId || !userId) return;

    showLoader('Approving request...');
    try {
        const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
        const t = snap.val();
        if (!t) { showToast('Tournament not found', 'error'); return; }
        if (t.hostId !== appState.currentUser.uid) { showToast('Unauthorized', 'error'); return; }

        const registeredCount = Object.keys(t.registeredPlayers || {}).length;
        const maxPlayers = t.maxPlayers || 2;
        if (registeredCount >= maxPlayers) { showToast('Match is already full', 'error'); return; }

        // Check user balance
        const userSnap = await db.ref(`users/${userId}`).once('value');
        const user = userSnap.val();
        if (!user) { showToast('User not found', 'error'); return; }
        const totalBalance = (user.depositBalance || 0) + (user.winningCash || 0) + (user.bonusCash || 0);
        if (totalBalance < t.entryFee) {
            showToast('User has insufficient balance', 'error');
            return;
        }

        // Deduct fee from user's wallet
        const deducted = await deductFromWalletForUser(userId, t.entryFee, 'join_fee', `Joined match: ${t.name}`);
        if (!deducted) { showToast('Failed to deduct entry fee', 'error'); return; }

        // Move from joinRequests to registeredPlayers
        const requestData = t.joinRequests[userId];
        const playerData = {
            uid: userId,
            name: requestData.name,
            gameUid: requestData.gameUid || '',
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        const dbUpdates = {};
        dbUpdates[`tournaments/${tournamentId}/registeredPlayers/${userId}`] = playerData;
        dbUpdates[`tournaments/${tournamentId}/joinRequests/${userId}`] = null; // remove request
        dbUpdates[`users/${userId}/joinedTournaments/${tournamentId}`] = true;

        // Check if match becomes full
        if (registeredCount + 1 === maxPlayers) {
            dbUpdates[`tournaments/${tournamentId}/status`] = 'ongoing';
            dbUpdates[`tournaments/${tournamentId}/fullSince`] = firebase.database.ServerValue.TIMESTAMP;
        }

        await db.ref().update(dbUpdates);

        // Notify player
        sendNotification(userId, 'Join Request Approved', `Your request to join ${t.name} has been approved. Entry fee deducted.`);

        showToast('Request approved. Player joined.');
        loadHomeData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
}

async function rejectRequestHandler(e) {
    const tournamentId = e.target.dataset.id;
    const userId = e.target.dataset.user;
    if (!tournamentId || !userId) return;

    showLoader('Rejecting request...');
    try {
        const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
        const t = snap.val();
        if (!t) { showToast('Tournament not found', 'error'); return; }
        if (t.hostId !== appState.currentUser.uid) { showToast('Unauthorized', 'error'); return; }

        await db.ref(`tournaments/${tournamentId}/joinRequests/${userId}`).remove();

        // Notify player
        sendNotification(userId, 'Join Request Rejected', `Your request to join ${t.name} was rejected by the host.`);

        showToast('Request rejected.');
        loadHomeData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
}

// Helper to deduct from any user's wallet (used by host when approving)
async function deductFromWalletForUser(userId, amount, reason, description) {
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
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
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

        if (countdownIntervals[appState.currentMatchId]) {
            clearInterval(countdownIntervals[appState.currentMatchId]);
            delete countdownIntervals[appState.currentMatchId];
        }

        showToast('Room details provided');
        bootstrap.Modal.getInstance(document.getElementById('provideRoomModal')).hide();
        document.getElementById('provideRoomId').value = '';
        document.getElementById('provideRoomPassword').value = '';
        loadHomeData();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally { hideLoader(); }
});

// ==================== WIN CLAIM WITH SCREENSHOT UPLOAD ====================
async function claimWinHandler(e) {
    const tournamentId = e.target.dataset.id;
    if (!appState.currentUser) return;

    window.currentWinTournamentId = tournamentId;

    document.getElementById('winFileInput').value = '';
    document.getElementById('winPreviewContainer').style.display = 'none';
    document.getElementById('winUploadArea').style.display = 'block';
    document.getElementById('winPreview').src = '';

    new bootstrap.Modal(document.getElementById('winScreenshotModal')).show();
}
setupUpload('winUploadArea', 'winFileInput', 'winPreview', 'winPreviewContainer', 'removeWinBtn');

document.getElementById('submitWinScreenshotBtn')?.addEventListener('click', async () => {
    const tournamentId = window.currentWinTournamentId;
    if (!tournamentId) return;

    const fileInput = document.getElementById('winFileInput');
    if (!fileInput.files[0]) {
        showToast('Please select a screenshot', 'error');
        return;
    }

    showLoader('Submitting win claim...');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            await db.ref(`tournaments/${tournamentId}/results`).set({
                claimedBy: appState.currentUser.uid,
                claimedByName: appState.userProfile.displayName,
                screenshot: e.target.result,
                status: 'pending',
                claimedAt: firebase.database.ServerValue.TIMESTAMP
            });

            showToast('Win claim submitted, awaiting admin approval.');
            bootstrap.Modal.getInstance(document.getElementById('winScreenshotModal')).hide();
            loadHomeData();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            hideLoader();
        }
    };
    reader.readAsDataURL(fileInput.files[0]);
});

document.getElementById('winScreenshotModal')?.addEventListener('hidden.bs.modal', function () {
    window.currentWinTournamentId = null;
});

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

// ==================== REPORT HANDLER ====================
async function reportMatchHandler(e) {
    const tournamentId = e.target.dataset.id;
    const opponentId = e.target.dataset.opponent;
    if (!tournamentId) return;

    window.reportTournamentId = tournamentId;
    window.reportOpponentId = opponentId;

    document.getElementById('reportReason').value = '';
    document.querySelectorAll('input[name="reportReasonOption"]').forEach(r => r.checked = false);
    document.getElementById('reportFileInput').value = '';
    document.getElementById('reportPreviewContainer').style.display = 'none';
    document.getElementById('reportUploadArea').style.display = 'block';
    document.getElementById('reportPreview').src = '';

    new bootstrap.Modal(document.getElementById('reportModal')).show();
}

setupUpload('reportUploadArea', 'reportFileInput', 'reportPreview', 'reportPreviewContainer', 'removeReportBtn');

document.getElementById('submitReportBtn')?.addEventListener('click', async () => {
    const tournamentId = window.reportTournamentId;
    const opponentId = window.reportOpponentId;
    if (!tournamentId) return;

    let reason = document.getElementById('reportReason').value.trim();
    const selectedOption = document.querySelector('input[name="reportReasonOption"]:checked');
    if (selectedOption) {
        reason = selectedOption.value;
    }
    if (!reason) {
        showToast('Please select or enter a reason', 'error');
        return;
    }

    const fileInput = document.getElementById('reportFileInput');
    let screenshot = null;
    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            screenshot = ev.target.result;
            await submitReport(tournamentId, opponentId, reason, screenshot);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await submitReport(tournamentId, opponentId, reason, null);
    }
});

async function submitReport(tournamentId, opponentId, reason, screenshot) {
    showLoader('Submitting report...');
    try {
        await db.ref('reports').push({
            tournamentId,
            reportedUserId: opponentId,
            reporterId: appState.currentUser.uid,
            reporterName: appState.userProfile.displayName,
            reason,
            screenshot: screenshot || null,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Report submitted. Admin will review.');
        bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
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

// ==================== DELETE WITH TWO OPTIONS ====================
async function deleteTournamentHandler(e) {
    const id = e.target.closest('.delete-tournament')?.dataset.id;
    if (!id) return;
    
    appState.tournamentToDelete = id;
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteOptionsModal'));
    deleteModal.show();
}

document.getElementById('deleteWithRefundBtn')?.addEventListener('click', async () => {
    const id = appState.tournamentToDelete;
    if (!id) return;
    
    bootstrap.Modal.getInstance(document.getElementById('deleteOptionsModal')).hide();
    showLoader('Processing refunds...');
    try {
        await cancelTournamentWithRefund(id);
        showToast('Tournament cancelled and refunds issued');
        loadHomeData();
        if (appState.currentSection === 'br-section') {
            const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
            const activeMode = document.querySelector('[data-admin-mode].active')?.dataset.adminMode || 'all';
            loadAdminTournaments(activeTab, activeMode);
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
        appState.tournamentToDelete = null;
    }
});

document.getElementById('deleteWithoutRefundBtn')?.addEventListener('click', async () => {
    const id = appState.tournamentToDelete;
    if (!id) return;
    
    if (appState.userProfile.role !== 'admin') {
        showToast('Only admin can delete without refund', 'error');
        return;
    }

    bootstrap.Modal.getInstance(document.getElementById('deleteOptionsModal')).hide();
    showLoader('Deleting tournament...');
    try {
        await db.ref(`tournaments/${id}`).remove();
        showToast('Tournament deleted without refund');
        loadHomeData();
        if (appState.currentSection === 'br-section') {
            const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
            const activeMode = document.querySelector('[data-admin-mode].active')?.dataset.adminMode || 'all';
            loadAdminTournaments(activeTab, activeMode);
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
        appState.tournamentToDelete = null;
    }
});

// ==================== CANCEL TOURNAMENT WITH REFUND ====================
async function cancelTournamentWithRefund(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (!t) return;

    const players = t.registeredPlayers || {};
    const entryFee = t.entryFee || 0;

    for (const uid in players) {
        await db.ref(`users/${uid}`).transaction((user) => {
            if (!user) return user;
            user.depositBalance = (Number(user.depositBalance) || 0) + entryFee;
            return user;
        });
        await db.ref(`transactions/${uid}`).push({
            type: 'refund',
            amount: entryFee,
            description: 'Match cancelled – refund issued',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    await db.ref(`tournaments/${tournamentId}`).remove();

    if (countdownIntervals[tournamentId]) {
        clearInterval(countdownIntervals[tournamentId]);
        delete countdownIntervals[tournamentId];
    }
}

// ==================== AUTO ROOM REVEAL FOR ADMIN TOURNAMENTS ====================
async function checkAdminRoomReveal() {
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;

    const snapshot = await db.ref('tournaments')
        .orderByChild('isAdminTournament')
        .equalTo(true)
        .once('value');

    const tournaments = snapshot.val() || {};
    const dbUpdates = {};

    Object.entries(tournaments).forEach(([id, t]) => {
        if (!t.matchDate) return;
        const timeDiff = t.matchDate - now;
        if (timeDiff <= twoMinutes && timeDiff > 0 && !t.showIdPass) {
            dbUpdates[`tournaments/${id}/showIdPass`] = true;
        }
    });

    if (Object.keys(dbUpdates).length > 0) {
        await db.ref().update(dbUpdates);
    }
}

// ==================== AUTO REFUND SYSTEM ====================
async function autoCancelFullMatch(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (!t || t.status === 'completed' || t.showIdPass) return;

    const players = t.registeredPlayers || {};
    for (const uid in players) {
        await db.ref(`users/${uid}`).transaction((user) => {
            if (!user) return user;
            user.depositBalance = (Number(user.depositBalance) || 0) + t.entryFee;
            return user;
        });
        await db.ref(`transactions/${uid}`).push({
            type: 'refund',
            amount: t.entryFee,
            description: 'Match cancelled (host did not provide room)',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }
    await db.ref(`tournaments/${tournamentId}`).remove();
    showToast('Match cancelled: host did not provide room details', 'info');
}

async function autoCancelMatch(tournamentId) {
    const snap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const t = snap.val();
    if (!t || t.status !== 'upcoming') return;

    const registeredCount = Object.keys(t.registeredPlayers || {}).length;
    const maxPlayers = t.maxPlayers || 2;

    if (registeredCount < maxPlayers) {
        const hostId = t.hostId;
        await db.ref(`users/${hostId}`).transaction((user) => {
            if (!user) return user;
            user.depositBalance = (Number(user.depositBalance) || 0) + t.entryFee;
            return user;
        });
        await db.ref(`transactions/${hostId}`).push({
            type: 'refund',
            amount: t.entryFee,
            description: 'Match cancelled (no opponent)',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        await db.ref(`tournaments/${tournamentId}`).remove();
        showToast('Match cancelled due to inactivity', 'info');
    }
}

function startCountdowns() {
    document.querySelectorAll('[id^="countdown-"]').forEach(el => {
        const id = el.id.replace('countdown-', '');
        const card = document.querySelector(`.tournament-card[data-id="${id}"]`);
        if (!card) return;

        const createdAt = parseInt(card.dataset.created);
        const fullSince = parseInt(card.dataset.fullsince);

        if (fullSince) {
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
document.getElementById('hostGame')?.addEventListener('change', function() {
    const game = this.value;
    const container = document.getElementById('gameSpecificOptions');
    if (gameOptionsTemplates[game]) {
        container.innerHTML = gameOptionsTemplates[game];
    } else {
        container.innerHTML = '';
    }
});

if (document.getElementById('hostGame')) {
    document.getElementById('hostGame').dispatchEvent(new Event('change'));
}

// ==================== HOST MATCH CREATION ====================
document.getElementById('openHostConfirmModal')?.addEventListener('click', async () => {
    if (!appState.currentUser) {
        showToast('Login first', 'error');
        return;
    }

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
    const teamSizeSelect = document.getElementById('hostTeamSize');
    let teamSize = 1;
    if (teamSizeSelect) {
        teamSize = parseInt(teamSizeSelect.value);
    }
    let matchDateTime = document.getElementById('hostMatchDateTime')?.value;
    let matchTimestamp;
    if (matchDateTime) {
        matchTimestamp = new Date(matchDateTime).getTime();
    } else {
        matchTimestamp = Date.now() + 10 * 60 * 1000;
    }

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
    const maxPlayers = teamSize === 1 ? 2 : (teamSize === 2 ? 2 : 4);
    const totalPool = fee * maxPlayers;
    const platformFee = totalPool * 0.05;
    const winningPrize = totalPool - platformFee;

    document.getElementById('confirmTotalPool').value = formatCurrency(totalPool);
    document.getElementById('confirmPlatformFee').value = formatCurrency(platformFee);
    document.getElementById('confirmWinningPrize').value = formatCurrency(winningPrize);
    document.getElementById('confirmTotalPlayers').value = maxPlayers;

    window.pendingHostData = { game, uid, fee, gameOptions, matchTimestamp, teamSize, maxPlayers };
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
        const tournamentData = {
            game: data.game,
            name: `${data.game} ${data.teamSize===1?'Solo':data.teamSize===2?'Duo':'Squad'} Match`,
            hostId: appState.currentUser.uid,
            hostName: appState.userProfile.displayName,
            hostUid: data.uid,
            hostAvatar: appState.userProfile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(appState.userProfile.displayName || 'User')}&background=ffd700&color=000&size=35`,
            entryFee: data.fee,
            teamSize: data.teamSize,
            maxPlayers: data.maxPlayers,
            status: 'upcoming',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            matchDate: data.matchTimestamp,
            registeredPlayers: {},
            joinRequests: {},
            showIdPass: false,
            roomId: '',
            roomPassword: '',
            gameOptions: data.gameOptions,
            isAdminTournament: false
        };
        tournamentData.registeredPlayers[appState.currentUser.uid] = {
            uid: appState.currentUser.uid,
            name: appState.userProfile.displayName,
            gameUid: data.uid,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        const newRef = await db.ref('tournaments').push(tournamentData);
        const tournamentId = newRef.key;
        await db.ref(`users/${appState.currentUser.uid}/joinedTournaments/${tournamentId}`).set(true);
        showToast('Match created!');
        document.getElementById('hostMatchForm')?.reset();
        document.getElementById('hostFee').value = '10';
        document.getElementById('hostGame').dispatchEvent(new Event('change'));
        if (document.getElementById('hostMatchDateTime')) document.getElementById('hostMatchDateTime').value = '';
        showSection('home-section');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
});

// ==================== DAILY ADMIN TOURNAMENT GENERATION ====================
async function generateDailyTournaments() {
    const today = new Date().toDateString();
    const snapshot = await db.ref('tournaments').orderByChild('dailyDate').equalTo(today).once('value');
    if (snapshot.exists()) return;

    const schedules = [
        { time: '7:00', mode: 'Solo', entry: 30, maxPlayers: 24 },
        { time: '7:30', mode: 'Duo', entry: 50, maxPlayers: 24 },
        { time: '8:00', mode: 'Squad', entry: 50, maxPlayers: 24 },
        { time: '8:30', mode: 'Solo', entry: 30, maxPlayers: 24 },
        { time: '9:00', mode: 'Duo', entry: 50, maxPlayers: 24 },
        { time: '9:30', mode: 'Squad', entry: 50, maxPlayers: 24 },
        { time: '10:00', mode: 'Solo', entry: 30, maxPlayers: 48 }
    ];
    const dateObj = new Date();
    for (let s of schedules) {
        const [hours, minutes] = s.time.split(':');
        const matchDate = new Date(dateObj);
        matchDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        const matchTimestamp = matchDate.getTime();

        const tournament = {
            game: 'freefire',
            name: `Daily ${s.mode} - ${s.time}`,
            hostId: 'admin',
            hostName: 'Admin',
            hostUid: 'ADMIN',
            hostAvatar: 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png',
            entryFee: s.entry,
            prizePool: s.entry * s.maxPlayers,
            maxPlayers: s.maxPlayers,
            teamSize: s.mode === 'Solo' ? 1 : (s.mode === 'Duo' ? 2 : 4),
            matchDate: matchTimestamp,
            status: 'upcoming',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            registeredPlayers: {},
            showIdPass: false,
            roomId: '',
            roomPassword: '',
            isAdminTournament: true,
            isDaily: true,
            dailyDate: today,
            mode: s.mode,
            distributionType: 'Winner Takes All',
            gameOptions: { mode: s.mode, playerFormat: s.mode === 'Solo' ? '1v1' : s.mode === 'Duo' ? '2v2' : '4v4' }
        };
        await db.ref('tournaments').push(tournament);
    }
    console.log('Daily tournaments generated');
}

// ==================== ADMIN TOURNAMENT LOADING WITH FILTERS ====================
async function loadAdminTournaments(status, mode = 'all') {
    const snapshot = await db.ref('tournaments').once('value');
    const tournaments = snapshot.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.isAdminTournament && t.status === status) {
            if (mode === 'all' || t.mode === mode) {
                html += renderTournamentCard(id, t);
            }
        }
    }
    const container = document.getElementById('adminTournamentsContainer');
    if (container) {
        container.innerHTML = html || '<p class="text-secondary text-center">No tournaments found</p>';
    }
    attachTournamentListeners();
    startCountdowns();
}

document.querySelectorAll('[data-admin-status]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-admin-status]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const activeMode = document.querySelector('[data-admin-mode].active')?.dataset.adminMode || 'all';
        loadAdminTournaments(this.dataset.adminStatus, activeMode);
    });
});

document.querySelectorAll('[data-admin-mode]').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('[data-admin-mode]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const activeStatus = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
        loadAdminTournaments(activeStatus, this.dataset.adminMode);
    });
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
    const distributionType = document.getElementById('adminDistributionType').value;
    const maxPlayers = parseInt(document.getElementById('adminMaxPlayers').value);
    const name = document.getElementById('adminTournamentName').value || `${game} Admin Tournament`;

    if (!matchDateTime || !entryFee || !maxPlayers || !distributionType) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    showLoader('Creating tournament...');
    try {
        const tournamentData = {
            game,
            name,
            hostId: appState.currentUser.uid,
            hostName: 'Admin',
            hostUid: 'ADMIN',
            hostAvatar: 'https://i.ibb.co/nMB5h8tG/file-00000000600871fa8ab73cff3469d5b3.png',
            entryFee,
            distributionType,
            maxPlayers,
            teamSize: 1,
            matchDate: new Date(matchDateTime).getTime(),
            status: 'upcoming',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            registeredPlayers: {},
            showIdPass: false,
            roomId: '',
            roomPassword: '',
            isAdminTournament: true,
            isDaily: false,
            mode: 'Solo'
        };
        await db.ref('tournaments').push(tournamentData);
        showToast('Tournament created successfully!');
        document.getElementById('adminCreateTournamentForm').reset();
        const activeTab = document.querySelector('[data-admin-status].active')?.dataset.adminStatus || 'upcoming';
        const activeMode = document.querySelector('[data-admin-mode].active')?.dataset.adminMode || 'all';
        loadAdminTournaments(activeTab, activeMode);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
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
        showToast('Withdrawal request submitted! Processed by 10:30 PM');
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
    loadComplaintTournaments();
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
        if (t && t.status === 'ongoing' && !t.winnerId && !t.results) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${t.name} (${t.game})`;
            select.appendChild(option);
        }
    }
}

document.getElementById('winBtn')?.addEventListener('click', () => {
    const matchId = document.getElementById('resultMatchSelect')?.value;
    if (!matchId) { showToast('Select a match', 'error'); return; }
    window.currentWinTournamentId = matchId;
    document.getElementById('winFileInput').value = '';
    document.getElementById('winPreviewContainer').style.display = 'none';
    document.getElementById('winUploadArea').style.display = 'block';
    document.getElementById('winPreview').src = '';
    new bootstrap.Modal(document.getElementById('winScreenshotModal')).show();
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
setupUpload('reportUploadArea', 'reportFileInput', 'reportPreview', 'reportPreviewContainer', 'removeReportBtn');
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

document.getElementById('generateQrBtn')?.addEventListener('click', async function() {
    const amount = document.getElementById('addAmount').value;
    if (!amount || amount < 10 || amount > 1000) {
        showToast('Please enter a valid amount between 10 and 1000', 'error');
        return;
    }

    // Fetch the eSewa ID from Firebase settings
    const settingsSnap = await db.ref('settings').once('value');
    const settings = settingsSnap.val() || {};
    const esewaId = settings.esewaId || 'tournament@bank';

    const payUrl = `upi://pay?pa=${esewaId}&pn=AdproTournament&am=${amount}&cu=NPR`;
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.style.display = 'block';

    if (qrCodeInstance) qrCodeInstance.clear();
    qrCodeInstance = new QRCode(document.getElementById('qrCode'), {
        text: payUrl,
        width: 200,
        height: 200
    });
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
    const snap = await db.ref('tournaments').once('value');
    const tournaments = snap.val() || {};
    let html = '';
    for (const [id, t] of Object.entries(tournaments)) {
        if (t.results && t.results.status === 'pending') {
            html += `
                <div class="border-bottom p-2" data-id="${id}">
                    <p><strong>${t.results.claimedByName || t.results.claimedBy}</strong> claims win in match ${t.name}</p>
                    <img src="${t.results.screenshot}" style="max-width:100%; max-height:200px;" class="rounded mb-2">
                    <div class="d-flex gap-2">
                        <button class="btn-custom btn-custom-success btn-sm approve-result" data-id="${id}" data-user="${t.results.claimedBy}">Approve</button>
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
            const tournamentId = e.target.dataset.id;
            const winnerId = e.target.dataset.user;
            await approveResult(tournamentId, winnerId);
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
            const tournamentId = e.target.dataset.id;
            const reasonInput = e.target.closest('.reject-reason').querySelector('input');
            const reason = reasonInput.value;
            if (!reason) return showToast('Enter reason', 'error');
            await rejectResult(tournamentId, reason);
        });
    });
}
async function approveResult(tournamentId, winnerId) {
    showLoader('Approving...');
    const matchSnap = await db.ref(`tournaments/${tournamentId}`).once('value');
    const match = matchSnap.val();
    if (!match) return showToast('Match not found', 'error');
    const totalPool = match.entryFee * (match.maxPlayers || 2);
    const commission = totalPool * 0.05;
    const prize = totalPool - commission;
    await addToWallet(prize, 'match_win', `Won match ${match.name}`, 'winning');
    await addToWallet(commission, 'commission', `5% commission from ${match.name}`, 'deposit');
    await db.ref(`tournaments/${tournamentId}`).update({ 
        status: 'completed', 
        winnerId: winnerId,
        'results/status': 'approved'
    });
    sendNotification(winnerId, 'Match Won', `You won ${match.name} and received NPR ${prize}`);
    sendNotification(match.hostId, 'Match Completed', `Your match ${match.name} has been completed.`);

    showToast('Result approved, prize credited');
    loadAdminResults();
    hideLoader();
}
async function rejectResult(tournamentId, reason) {
    showLoader();
    await db.ref(`tournaments/${tournamentId}/results`).update({ status: 'rejected', reason });
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
    new bootstrap.Modal(document.getElementById('chatModal')).show();
}
async function loadChatMessages(matchId) {
    const snap = await db.ref(`chats/${matchId}`).orderByChild('timestamp').once('value');
    const msgs = snap.val() || {};
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    Object.values(msgs).forEach(m => {
        const div = document.createElement('div');
        div.className = `chat-message ${m.userId === appState.currentUser?.uid ? 'own' : ''}`;
        div.innerHTML = `<strong>${m.userName}:</strong> ${m.text}<br><small>${formatDate(m.timestamp)}</small>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}
document.getElementById('sendChatBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || !currentChatMatchId) return;
    await db.ref(`chats/${currentChatMatchId}`).push({
        userId: appState.currentUser.uid,
        userName: appState.userProfile.displayName,
        text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
    loadChatMessages(currentChatMatchId);
});

// ==================== NOTIFICATIONS ====================
setInterval(() => {
    if (!appState.currentUser) return;
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
    window.reportTournamentId = matchId;
    window.reportOpponentId = userId;
    document.getElementById('reportReason').value = '';
    document.querySelectorAll('input[name="reportReasonOption"]').forEach(r => r.checked = false);
    document.getElementById('reportFileInput').value = '';
    document.getElementById('reportPreviewContainer').style.display = 'none';
    document.getElementById('reportUploadArea').style.display = 'block';
    document.getElementById('reportPreview').src = '';
    new bootstrap.Modal(document.getElementById('reportModal')).show();
}

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
            const createSection = document.getElementById('adminCreateTournamentSection');
            if (createSection) createSection.style.display = 'block';
        }
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
            const activeMode = document.querySelector('[data-admin-mode].active')?.dataset.adminMode || 'all';
            loadAdminTournaments(activeTab, activeMode);
            break;
        }
        case 'wallet-section': loadWalletData(); break;
        case 'admin-section':
            loadAdminResults();
            loadAdminPayments();
            loadAdminComplaints();
            break;
    }
    checkAdminRoomReveal();
}, 10000);

// ==================== SWIPER ====================
new Swiper('#heroSlider', { loop: true, autoplay: { delay: 3000 }, pagination: { el: '.swiper-pagination' } });

// ==================== REQUEST NOTIFICATION PERMISSION ====================
requestNotificationPermission();

// ==================== GENERATE DAILY TOURNAMENTS ON ADMIN LOGIN ====================
auth.onAuthStateChanged(user => {
    if (user && appState.userProfile.role === 'admin') {
        generateDailyTournaments();
    }
});
