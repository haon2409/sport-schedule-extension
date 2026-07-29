let followedTeams = [];
let followedTournaments = [];
let selectedTeamId = null;
let selectedTournamentId = null;
let originalFollowedTeams = []; // Biến lưu bản sao để khôi phục khi Cancel
let isEditingTeams = false;
let originalFollowedTournaments = []; // Bản sao để khôi phục khi Cancel giải đấu
let isEditingTournaments = false;
const API_URL = 'https://api.pandascore.co';
const CACHE_DURATION = 60 * 60 * 1000;

// Hàm lấy API key từ chrome.storage.sync
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['pandascoreApiKey'], (result) => {
      resolve(result.pandascoreApiKey || '');
    });
  });
}

// Hàm fetch dữ liệu có tích hợp cache 60 phút
async function cachedFetch(url) {
  const API_KEY = await getApiKey();
  if (!API_KEY) {
    throw new Error('Chưa cấu hình API Key. Vui lòng bấm chuột phải vào icon tiện ích -> Options để cài đặt.');
  }

  return new Promise((resolve, reject) => {
    const cacheKey = 'api_cache_' + url;
    const now = Date.now();

    chrome.storage.local.get([cacheKey], async (result) => {
      const cached = result[cacheKey];
      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        resolve(cached.data);
        return;
      }

      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
          mode: 'cors'
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        chrome.storage.local.set({ [cacheKey]: { data, timestamp: now } }, () => {
          updateClearCacheButtonState();
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Cập nhật trạng thái Enable/Disable của nút Xóa cache
function updateClearCacheButtonState() {
  const btn = document.getElementById('clearCacheBtn');
  if (!btn) return;

  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const hasValidCache = Object.keys(items).some(key => {
      if (key.startsWith('api_cache_')) {
        const cached = items[key];
        return cached && (now - cached.timestamp < CACHE_DURATION);
      }
      return false;
    });

    if (hasValidCache) {
      btn.removeAttribute('disabled');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.setAttribute('disabled', 'true');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
  });
}

// Hàm thực hiện xóa toàn bộ cache API
async function clearAllCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(key => key.startsWith('api_cache_'));
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          updateClearCacheButtonState();
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Khởi tạo khi popup được mở
document.addEventListener('DOMContentLoaded', async () => {
  const followedTeamsDiv = document.getElementById('followedTeams');
  followedTeamsDiv.innerHTML = '<div class="loading">Đang tải danh sách đội...</div>';

  // Chèn nút "Xóa cache" và nút "Cài đặt" cạnh tiêu đề chính
  const headerTitle = document.querySelector('h1') || document.querySelector('.header-title') || document.querySelector('header');
  if (headerTitle && !document.getElementById('clearCacheBtn')) {

    // Tạo nhóm chứa nút bấm để căn chỉnh gọn gàng
    const actionContainer = document.createElement('div');
    actionContainer.style.display = 'inline-block';
    actionContainer.style.float = 'right';

    // 1. Tạo nút Cài đặt (Icon bánh răng)
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'settingsBtn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Cài đặt API Key';
    settingsBtn.style.marginLeft = '5px';
    settingsBtn.style.padding = '2px 6px';
    settingsBtn.style.fontSize = '11px';
    settingsBtn.style.cursor = 'pointer';

    settingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });

    // 2. Tạo nút Xóa cache (như cũ)
    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.id = 'clearCacheBtn';
    clearCacheBtn.className = 'clear-cache-btn';
    clearCacheBtn.textContent = 'Xóa cache';
    clearCacheBtn.style.marginLeft = '5px';
    clearCacheBtn.style.padding = '2px 6px';
    clearCacheBtn.style.fontSize = '11px';
    clearCacheBtn.style.cursor = 'pointer';

    clearCacheBtn.addEventListener('click', async () => {
      await clearAllCache();
    });

    // Đưa cả 2 nút vào container rồi gắn lên tiêu đề
    actionContainer.appendChild(settingsBtn);
    actionContainer.appendChild(clearCacheBtn);
    headerTitle.appendChild(actionContainer);

    const editBtn = document.getElementById('editTeamsBtn');
    const saveBtn = document.getElementById('saveTeamsBtn');
    const cancelBtn = document.getElementById('cancelTeamsBtn');
    const actionBtnsDiv = document.getElementById('teamEditActionBtns');

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isEditingTeams = true;
        originalFollowedTeams = JSON.parse(JSON.stringify(followedTeams)); // Sao lưu dữ liệu hiện tại
        editBtn.style.display = 'none';
        actionBtnsDiv.style.display = 'flex';
        displayFollowedTeams(); // Render lại để bật trạng thái kéo thả
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        isEditingTeams = false;
        followedTeams = JSON.parse(JSON.stringify(originalFollowedTeams)); // Khôi phục dữ liệu cũ
        actionBtnsDiv.style.display = 'none';
        editBtn.style.display = 'inline-block';
        displayFollowedTeams();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        isEditingTeams = false;
        actionBtnsDiv.style.display = 'none';
        editBtn.style.display = 'inline-block';
        saveFollowedTeams(); // Lưu vào storage
        displayFollowedTeams();
      });
    }

    const editTournamentBtn = document.getElementById('editTournamentsBtn');
    const saveTournamentBtn = document.getElementById('saveTournamentsBtn');
    const cancelTournamentBtn = document.getElementById('cancelTournamentsBtn');
    const tournamentActionBtnsDiv = document.getElementById('tournamentEditActionBtns');

    if (editTournamentBtn) {
      editTournamentBtn.addEventListener('click', () => {
        isEditingTournaments = true;
        originalFollowedTournaments = JSON.parse(JSON.stringify(followedTournaments));
        editTournamentBtn.style.display = 'none';
        tournamentActionBtnsDiv.style.display = 'flex';
        displayFollowedTournaments();
      });
    }

    if (cancelTournamentBtn) {
      cancelTournamentBtn.addEventListener('click', () => {
        isEditingTournaments = false;
        followedTournaments = JSON.parse(JSON.stringify(originalFollowedTournaments));
        tournamentActionBtnsDiv.style.display = 'none';
        editTournamentBtn.style.display = 'inline-block';
        displayFollowedTournaments();
      });
    }

    if (saveTournamentBtn) {
      saveTournamentBtn.addEventListener('click', () => {
        isEditingTournaments = false;
        tournamentActionBtnsDiv.style.display = 'none';
        editTournamentBtn.style.display = 'inline-block';
        saveFollowedTournaments();
        displayFollowedTournaments();
      });
    }
  }

  updateClearCacheButtonState();

  chrome.storage.local.get(['followedTeams', 'followedTournaments'], async (result) => {
    if (result.followedTeams) {
      followedTeams = result.followedTeams;
      await checkMatchesOnPopupOpen();
      displayFollowedTeams();
    } else {
      followedTeamsDiv.innerHTML = '';
    }
    if (result.followedTournaments) {
      followedTournaments = result.followedTournaments;
      await checkTournamentMatchesOnPopupOpen();
      displayFollowedTournaments();
    }
    updateClearCacheButtonState();
  });

  document.getElementById('searchButton').addEventListener('click', searchTeam);
  document.getElementById('teamSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTeam();
  });

  document.getElementById('tournamentSearchButton').addEventListener('click', searchTournament);
  document.getElementById('tournamentSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTournament();
  });

  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const container = button.closest('.tabs').parentElement;
      container.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      const targetTab = container.querySelector(`#${button.dataset.tab}-tab`);
      if (targetTab) targetTab.classList.add('active');
    });
  });
});

function isToday(dateString) {
  if (!dateString) return false;
  const matchDate = new Date(dateString);
  const today = new Date();
  return matchDate.getDate() === today.getDate() &&
    matchDate.getMonth() === today.getMonth() &&
    matchDate.getFullYear() === today.getFullYear();
}

function getMatchTournamentName(match) {
  const leagueName = match?.league?.name;
  if (!leagueName) return null;

  const abbreviations = {
    'Esports World Cup': 'EWC',
  };
  return abbreviations[leagueName] || leagueName;
}

async function checkMatchesOnPopupOpen() {
  try {
    if (!followedTeams || followedTeams.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const matchPromises = followedTeams.map(async (team) => {
      const liveData = await cachedFetch(`${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}&include=${matchInclude}`);
      if (liveData.length > 0) return { teamId: team.id, match: liveData[0], type: 'live' };

      const upcomingData = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&per_page=1&sort=begin_at&include=${matchInclude}`);
      if (upcomingData.length > 0) return { teamId: team.id, match: upcomingData[0], type: 'upcoming' };

      const pastData = await cachedFetch(`${API_URL}/lol/matches/past?filter[opponent_id]=${team.id}&per_page=1&sort=-end_at&include=${matchInclude}`);
      if (pastData.length > 0) return { teamId: team.id, match: pastData[0], type: 'past' };

      return null;
    });

    const matches = (await Promise.all(matchPromises)).filter(match => match !== null);

    followedTeams.forEach(team => {
      const matchData = matches.find(m => m.teamId === team.id);
      team.matchData = matchData ? {
        opponent: matchData.match.opponents.find(o => o.opponent.id !== team.id)?.opponent,
        matchTime: matchData.match.scheduled_at || matchData.match.begin_at || matchData.match.end_at,
        status: matchData.type === 'live' ? 'Đang diễn ra' : matchData.type === 'upcoming' ? 'Sắp diễn ra' : 'Kết thúc',
        numberOfGames: matchData.match.number_of_games || null,
        tournamentName: getMatchTournamentName(matchData.match) || 'Không xác định'
      } : null;
    });
  } catch (error) {
    console.error('Error checking matches on popup open:', error);
  }
}

async function checkTournamentMatchesOnPopupOpen() {
  try {
    if (!followedTournaments || followedTournaments.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const matchPromises = followedTournaments.map(async (tournament) => {
      const liveData = await cachedFetch(`${API_URL}/lol/matches/running?filter[league_id]=${tournament.id}&include=${matchInclude}`);
      if (liveData.length > 0) {
        return { tournamentId: tournament.id, matches: liveData, type: 'live' };
      }

      // Lấy toàn bộ danh sách trận đấu diễn ra trong ngày hôm nay
      const todayMatches = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&range[begin_at]=${startOfDay},${endOfDay}&sort=begin_at&include=${matchInclude}`);
      if (todayMatches.length > 0) {
        return { tournamentId: tournament.id, matches: todayMatches, type: 'today' };
      }

      const upcomingData = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&per_page=1&sort=begin_at&include=${matchInclude}`);
      if (upcomingData.length > 0) {
        return { tournamentId: tournament.id, matches: upcomingData, type: 'upcoming' };
      }

      const pastData = await cachedFetch(`${API_URL}/lol/matches/past?filter[league_id]=${tournament.id}&per_page=1&sort=-end_at&include=${matchInclude}`);
      if (pastData.length > 0) {
        return { tournamentId: tournament.id, matches: pastData, type: 'past' };
      }

      return null;
    });

    const matchesResult = (await Promise.all(matchPromises)).filter(item => item !== null);

    followedTournaments.forEach(tournament => {
      const matchDataEntry = matchesResult.find(m => m.tournamentId === tournament.id);
      
      if (matchDataEntry && matchDataEntry.matches.length > 0) {
        tournament.matchData = {
          matches: matchDataEntry.matches, // Lưu trữ toàn bộ danh sách trận đấu trong ngày
          status: matchDataEntry.type === 'live' ? 'Đang diễn ra' : matchDataEntry.type === 'today' ? 'Hôm nay' : 'Sắp diễn ra'
        };
      } else {
        tournament.matchData = null;
      }
    });
  } catch (error) {
    console.error('Error checking tournament matches on popup open:', error);
  }
}

function handleImageError(img) {
  img.src = 'https://via.placeholder.com/24';
}

function createFollowedItemHTML(item, type = 'team') {
  const displayName = item.acronym || item.name;
  const logoUrl = item.image_url || 'https://via.placeholder.com/24';

  const leftBlock = `
    <div class="followed-team-block" data-id="${item.id}">
      <img class="${type}-logo team-logo" src="${logoUrl}" alt="${displayName}">
      <span class="followed-team-name">${displayName}</span>
    </div>`;

  let centerBlock, rightBlock;

  if (item.matchData) {
    const opponent = item.matchData.opponent;
    const oppDisplay = opponent?.acronym || opponent?.name || 'Chưa xác định';
    const oppLogo = opponent?.image_url || 'https://via.placeholder.com/24';
    const matchTime = formatDateTime(item.matchData.matchTime);
    const matchType = item.matchData.numberOfGames ? `BO${item.matchData.numberOfGames}` : '—';
    const tournamentName = item.matchData.tournamentName || 'Không xác định';
    const status = item.matchData.status === 'Sắp diễn ra' ? '' : (item.matchData.status || '');

    centerBlock = `
      <div class="followed-match-detail">
        <div class="followed-match-time">${matchTime}</div>
        <div class="followed-match-extra">
          <span class="followed-match-bo">${matchType}</span>
          <span class="followed-match-tournament">${tournamentName}</span>
          ${status ? `<span class="followed-match-status">${status}</span>` : ''}
        </div>
      </div>`;

    rightBlock = `
      <div class="followed-opponent-block" data-opponent-id="${opponent?.id || ''}">
        <span class="followed-opponent-name">${oppDisplay}</span>
        <img class="team-logo" src="${oppLogo}" alt="${oppDisplay}">
      </div>`;
  } else {
    centerBlock = `
      <div class="followed-match-detail followed-match-detail--muted">
        <div class="followed-match-time">—</div>
        <div class="followed-match-extra"><span class="followed-match-bo">Chưa có lịch</span></div>
      </div>`;
    rightBlock = '<div class="followed-opponent-block followed-opponent-block--empty" aria-hidden="true"></div>';
  }

  return `
    <div class="followed-row-inner">
      ${leftBlock}
      ${centerBlock}
      ${rightBlock}
    </div>`;
}

function createTournamentFollowedItemHTML(tournament) {
  const matchData = tournament.matchData;
  const tournamentName = tournament.acronym || tournament.name;
  const tournamentLogo = tournament.image_url || 'https://via.placeholder.com/24';

  const leftBlock = `
    <div class="followed-team-block">
      <img class="tournament-logo team-logo" src="${tournamentLogo}" alt="${tournamentName}">
      <span class="followed-team-name">${tournamentName}</span>
    </div>`;

  if (!matchData || !matchData.matches || matchData.matches.length === 0) {
    return `
      <div class="followed-row-inner" style="display: flex; justify-content: space-between; align-items: center;">
        ${leftBlock}
        <div class="followed-match-detail followed-match-detail--muted">
          <div class="followed-match-time">—</div>
          <div class="followed-match-extra"><span class="followed-match-bo">Chưa có lịch</span></div>
        </div>
        <div class="followed-opponent-block followed-opponent-block--empty" aria-hidden="true"></div>
      </div>`;
  }

  // Duyệt qua tất cả các trận đấu trong ngày và hiển thị logo + tên đội
  const matchesHtml = matchData.matches.map(match => {
    const opponents = match?.opponents?.map(o => o.opponent).filter(Boolean) || [];
    const team1 = opponents[0] || null;
    const team2 = opponents[1] || null;

    const team1Name = team1?.acronym || team1?.name || 'TBD';
    const team1Logo = team1?.image_url || 'https://via.placeholder.com/16';
    const team2Name = team2?.acronym || team2?.name || 'TBD';
    const team2Logo = team2?.image_url || 'https://via.placeholder.com/16';
    
    const matchTime = formatDateTime(match.scheduled_at || match.begin_at || match.end_at);
    const timeOnly = matchTime.split(',')[0].trim(); 
    const matchType = match.number_of_games ? `BO${match.number_of_games}` : '—';

    return `
      <div class="tournament-match-row" style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 6px; font-size: 11px; gap: 8px;">
        <span style="color: #666; margin-right: 4px;">${timeOnly} (${matchType})</span>
        <div style="display: flex; align-items: center; gap: 3px;">
          <img class="team-logo" src="${team1Logo}" alt="${team1Name}" style="width: 14px; height: 14px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/14'">
          <span style="font-weight: 500;">${team1Name}</span>
        </div>
        <span style="color: #888;">vs</span>
        <div style="display: flex; align-items: center; gap: 3px;">
          <img class="team-logo" src="${team2Logo}" alt="${team2Name}" style="width: 14px; height: 14px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/14'">
          <span style="font-weight: 500;">${team2Name}</span>
        </div>
      </div>
    `;
  }).join('');

  // Đưa khối danh sách trận đấu sang phía bên phải hoàn toàn
  const rightBlock = `
    <div class="followed-opponent-block" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center;">
      ${matchesHtml}
    </div>`;

  const centerBlock = `
    <div class="followed-match-detail" style="display: none;"></div>
  `;

  return `
    <div class="followed-row-inner" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
      ${leftBlock}
      ${centerBlock}
      ${rightBlock}
    </div>`;
}

function formatDateTime(dateString) {
  if (!dateString) return 'Chưa xác định';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Thời gian không hợp lệ';

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const weekday = weekdays[date.getDay()];
  return `${hours}:${minutes}, ${weekday}, ${day}/${month}`;
}

async function searchTeam() {
  const searchInput = document.getElementById('teamSearch');
  const teamName = searchInput.value.trim();
  if (!teamName) return;

  const oldSearchResults = document.querySelector('.search-results');
  if (oldSearchResults) oldSearchResults.remove();

  try {
    let data = await cachedFetch(`${API_URL}/lol/teams?search[name]=${encodeURIComponent(teamName)}&per_page=10`);

    if (data.length === 0) {
      data = await cachedFetch(`${API_URL}/lol/teams?search[acronym]=${encodeURIComponent(teamName)}&per_page=10`);
    }

    if (data.length > 0) {
      const searchResults = document.createElement('div');
      searchResults.className = 'search-results';
      searchResults.innerHTML = '<h3>Kết quả tìm kiếm:</h3>';
      data.forEach(team => {
        const teamElement = document.createElement('div');
        teamElement.className = 'team-item';
        teamElement.innerHTML = createFollowedItemHTML(team, 'team') + `<button class="add-team" data-team-id="${team.id}">+</button>`;
        const img = teamElement.querySelector('.team-logo');
        if (img) img.addEventListener('error', () => handleImageError(img));
        teamElement.querySelector('.add-team').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!followedTeams.some(t => t.id === team.id)) {
            team.matchData = null;
            followedTeams.push(team);
            saveFollowedTeams();
            displayFollowedTeams();
            searchResults.remove();
            searchInput.value = '';
          }
        });
        searchResults.appendChild(teamElement);
      });
      const followedTeamsDiv = document.getElementById('followedTeams');
      followedTeamsDiv.parentNode.insertBefore(searchResults, followedTeamsDiv);
    } else {
      alert('Không tìm thấy đội tuyển nào.');
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm đội:', error);
  }
}

async function searchTournament() {
  const searchInput = document.getElementById('tournamentSearch');
  const tournamentName = searchInput.value.trim();
  if (!tournamentName) return;

  const oldSearchResults = document.querySelector('.search-results');
  if (oldSearchResults) oldSearchResults.remove();

  try {
    let data = await cachedFetch(`${API_URL}/lol/tournaments?search[name]=${encodeURIComponent(tournamentName)}&per_page=10`);

    if (data.length === 0) {
      data = await cachedFetch(`${API_URL}/lol/leagues?search[name]=${encodeURIComponent(tournamentName)}&per_page=10`);
    }

    if (data.length > 0) {
      const searchResults = document.createElement('div');
      searchResults.className = 'search-results';
      searchResults.innerHTML = '<h3>Kết quả tìm kiếm:</h3>';
      data.forEach(tournament => {
        const tournamentElement = document.createElement('div');
        tournamentElement.className = 'tournament-item';

        const displayName = tournament.acronym || tournament.name;
        const logoUrl = tournament.image_url || 'https://via.placeholder.com/24';

        tournamentElement.innerHTML = `
          <div class="followed-row-inner">
            <div class="followed-team-block">
              <img class="tournament-logo team-logo" src="${logoUrl}" alt="${displayName}">
              <span class="followed-team-name">${displayName}</span>
            </div>
            <div class="followed-match-detail followed-match-detail--muted">
              <div class="followed-match-time">—</div>
              <div class="followed-match-extra"><span class="followed-match-bo">Giải đấu</span></div>
            </div>
            <div class="followed-opponent-block followed-opponent-block--empty" aria-hidden="true"></div>
          </div>
        ` + `<button class="add-tournament" data-tournament-id="${tournament.id}">+</button>`;

        const img = tournamentElement.querySelector('.team-logo');
        if (img) img.addEventListener('error', () => handleImageError(img));

        tournamentElement.querySelector('.add-tournament').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!followedTournaments.some(t => t.id === tournament.id)) {
            tournament.matchData = null;
            followedTournaments.push(tournament);
            saveFollowedTournaments();
            await checkTournamentMatchesOnPopupOpen();
            displayFollowedTournaments();
            searchResults.remove();
            searchInput.value = '';
          }
        });
        searchResults.appendChild(tournamentElement);
      });
      const followedTournamentsDiv = document.getElementById('followedTournaments');
      followedTournamentsDiv.parentNode.insertBefore(searchResults, followedTournamentsDiv);
    } else {
      alert('Không tìm thấy giải đấu nào.');
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm giải đấu:', error);
  }
}

function displayFollowedTeams() {
  const followedTeamsDiv = document.getElementById('followedTeams');

  // Nếu đang chỉnh sửa thì dùng mảng hiện tại, nếu không thì giữ nguyên thứ tự đã lưu (không tự động sort lại đè lên thứ tự kéo thả)
  const sortedTeams = followedTeams;

  followedTeamsDiv.innerHTML = sortedTeams.length === 0
    ? '<div class="no-data">Chưa theo dõi đội nào</div>'
    : sortedTeams.map((team, index) => {
      const html = createFollowedItemHTML(team, 'team');
      const hasMatchToday = team.matchData && isToday(team.matchData.matchTime) && team.matchData.type !== 'past';
      const todayClass = hasMatchToday ? 'match-today' : '';
      const selectedClass = selectedTeamId === team.id ? 'selected' : '';
      const draggableAttr = isEditingTeams ? 'draggable="true"' : '';
      const draggableClass = isEditingTeams ? 'draggable' : '';

      return `
          <div class="team-item ${todayClass} ${selectedClass} ${draggableClass}" ${draggableAttr} data-index="${index}" data-team-id="${team.id}">
            ${html}
            <span class="remove-team" data-team-id="${team.id}">✖</span>
          </div>`;
    }).join('');

  if (isEditingTeams) {
    let draggedIndex = null;

    followedTeamsDiv.querySelectorAll('.team-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(e.currentTarget.dataset.index, 10);
        e.currentTarget.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
        followedTeamsDiv.querySelectorAll('.team-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
      });

      item.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(e.currentTarget.dataset.index, 10);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          const movedItem = followedTeams.splice(draggedIndex, 1)[0];
          followedTeams.splice(targetIndex, 0, movedItem);
          displayFollowedTeams();
        }
      });
    });
  }

  followedTeamsDiv.querySelectorAll('.team-item img.team-logo').forEach(img => {
    img.addEventListener('error', () => handleImageError(img));
  });

  followedTeamsDiv.querySelectorAll('.team-item').forEach(el => {
    const followedId = parseInt(el.dataset.teamId, 10);
    el.querySelector('.followed-team-block')?.addEventListener('click', (e) => {
      if (isEditingTeams) return;
      e.stopPropagation();
      selectedTeamId = followedId;
      displayFollowedTeams();
      displayTeamSchedule(followedId);
    });
    const opponentEl = el.querySelector('.followed-opponent-block:not(.followed-opponent-block--empty)');
    if (opponentEl) {
      opponentEl.addEventListener('click', (e) => {
        if (isEditingTeams) return;
        e.stopPropagation();
        const oid = opponentEl.dataset.opponentId;
        if (oid) {
          selectedTeamId = parseInt(oid, 10);
          displayFollowedTeams();
          displayTeamSchedule(parseInt(oid, 10));
        }
      });
    }
  });

  followedTeamsDiv.querySelectorAll('.remove-team').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTeam(parseInt(btn.dataset.teamId));
    });
  });
}

function displayFollowedTournaments() {
  const followedTournamentsDiv = document.getElementById('followedTournaments');

  if (followedTournaments.length === 0) {
    followedTournamentsDiv.innerHTML = '<div class="no-data">Chưa theo dõi giải đấu nào</div>';
    return;
  }

  // Sử dụng trực tiếp mảng followedTournaments để tôn trọng thứ tự kéo thả thủ công
  const sortedTournaments = followedTournaments;

  followedTournamentsDiv.innerHTML = sortedTournaments.map((tournament, index) => {
    const html = createTournamentFollowedItemHTML(tournament);    
    // Kiểm tra xem trong danh sách matches có trận nào diễn ra hôm nay không
    const hasMatchToday = tournament.matchData && 
      tournament.matchData.matches && 
      tournament.matchData.matches.some(m => isToday(m.scheduled_at || m.begin_at || m.end_at)) && 
      tournament.matchData.status !== 'Kết thúc';
    const todayClass = hasMatchToday ? 'match-today' : '';
    const selectedClass = selectedTournamentId === tournament.id ? 'selected' : '';
    const draggableAttr = isEditingTournaments ? 'draggable="true"' : '';
    const draggableClass = isEditingTournaments ? 'draggable' : '';

    return `
      <div class="tournament-item ${todayClass} ${selectedClass} ${draggableClass}" ${draggableAttr} data-index="${index}" data-tournament-id="${tournament.id}">
        ${html}
        <span class="remove-team remove-tournament" data-tournament-id="${tournament.id}">✖</span>
      </div>`;
  }).join('');

  if (isEditingTournaments) {
    let draggedIndex = null;

    followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(e.currentTarget.dataset.index, 10);
        e.currentTarget.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
        followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
      });

      item.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(e.currentTarget.dataset.index, 10);
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          const movedItem = followedTournaments.splice(draggedIndex, 1)[0];
          followedTournaments.splice(targetIndex, 0, movedItem);
          displayFollowedTournaments();
        }
      });
    });
  }

  followedTournamentsDiv.querySelectorAll('.tournament-item img.team-logo').forEach(img => {
    img.addEventListener('error', () => handleImageError(img));
  });

  followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(item => {
    const tournamentId = parseInt(item.dataset.tournamentId, 10);
    item.addEventListener('click', (e) => {
      if (isEditingTournaments) return;
      if (e.target.classList.contains('remove-tournament')) return;

      selectedTournamentId = tournamentId;
      displayFollowedTournaments();

      displayTournamentSchedule(tournamentId);
      displayTournamentStandings(tournamentId);
    });
  });

  followedTournamentsDiv.querySelectorAll('.remove-tournament').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTournament(parseInt(button.dataset.tournamentId));
    });
  });
}

async function displayTeamSchedule(teamId) {
  const scheduleList = document.getElementById('scheduleList');
  const scheduleSection = document.querySelector('.schedule-section');
  scheduleSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  scheduleList.innerHTML = '<div class="loading">Đang tải lịch thi đấu...</div>';

  try {
    let team = followedTeams.find(t => t.id === teamId);
    if (!team) {
      team = await cachedFetch(`${API_URL}/teams/${teamId}`);
    }
    if (!team) team = { name: 'Đội tuyển', image_url: null };

    const liveData = await cachedFetch(`${API_URL}/lol/matches/running?filter[opponent_id]=${teamId}&include=opponents.opponent,league,tournament,serie`);
    const upcomingData = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[opponent_id]=${teamId}&per_page=5&include=opponents.opponent,league,tournament,serie`);
    const pastData = await cachedFetch(`${API_URL}/lol/matches/past?filter[opponent_id]=${teamId}&per_page=5&sort=-end_at&include=opponents.opponent,league,tournament,serie`);

    let html = '';

    const buildTeamHistoryRow = (match, options = {}) => {
      const { includeResult = false } = options;
      const opponents = match.opponents?.map(o => o.opponent).filter(Boolean) || [];
      const selectedOpponent = opponents.find(o => o?.id === teamId) || team;
      const otherOpponent = opponents.find(o => o?.id !== teamId) || null;

      const teamALogo = selectedOpponent?.image_url || team.image_url || 'https://via.placeholder.com/24';
      const teamAName = selectedOpponent?.acronym || selectedOpponent?.name || team.acronym || team.name || 'Chưa xác định';
      const teamBLogo = otherOpponent?.image_url || 'https://via.placeholder.com/24';
      const teamBName = otherOpponent?.acronym || otherOpponent?.name || 'Chưa xác định';

      const teamAScore = match.results?.find(r => r.team_id === selectedOpponent?.id)?.score;
      const teamBScore = match.results?.find(r => r.team_id === otherOpponent?.id)?.score;

      const scoreA = teamAScore ?? '-';
      const scoreB = teamBScore ?? '-';
      const matchTime = formatDateTime(match.scheduled_at || match.begin_at || match.end_at);
      const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'BO?';
      const tournamentName = getMatchTournamentName(match) || 'Không xác định';
      const detailLine = includeResult ? `${scoreA}-${scoreB}` : `${matchType}`;
      const boToneClass = includeResult
        ? ((Number(scoreA) >= Number(scoreB)) ? 'followed-match-bo--positive' : 'followed-match-bo--negative')
        : 'followed-match-bo--positive';

      return `
        <div class="schedule-item ${includeResult ? 'past' : 'upcoming'}">
          <div class="followed-row-inner">
            <div class="followed-team-block">
              <img class="team-logo" src="${teamALogo}" alt="${teamAName} logo">
              <span class="followed-team-name">${teamAName}</span>
            </div>
            <div class="followed-match-detail">
              <div class="followed-match-time">${matchTime}</div>
              <div class="followed-match-extra">
                <span class="followed-match-bo ${boToneClass}">${detailLine}</span>
                <span class="followed-match-tournament">${tournamentName}</span>
              </div>
            </div>
            <div class="followed-opponent-block">
              <span class="followed-opponent-name">${teamBName}</span>
              <img class="team-logo" src="${teamBLogo}" alt="${teamBName} logo">
            </div>
          </div>
        </div>
      `;
    };

    const filteredPastData = (pastData || []).filter(match => {
      const opponents = match.opponents?.map(o => o.opponent).filter(Boolean) || [];
      const selectedOpponent = opponents.find(o => o?.id === teamId) || team;
      const otherOpponent = opponents.find(o => o?.id !== teamId) || null;
      const teamAScore = match.results?.find(r => r.team_id === selectedOpponent?.id)?.score ?? 0;
      const teamBScore = match.results?.find(r => r.team_id === otherOpponent?.id)?.score ?? 0;
      return !(teamAScore === 0 && teamBScore === 0);
    });
    const reversedPastData = [...filteredPastData].reverse();

    html += '<h4>Trận đấu đã diễn ra</h4>';
    if (reversedPastData.length > 0) {
      reversedPastData.forEach(match => { html += buildTeamHistoryRow(match, { includeResult: true }); });
    } else {
      html += '<div class="no-matches">Không có trận đấu đã diễn ra</div>';
    }

    html += '<h4>Trận đấu đang diễn ra</h4>';
    if (liveData && liveData.length > 0) {
      liveData.forEach(match => {
        try {
          const team1 = match.opponents?.[0]?.opponent;
          const team2 = match.opponents?.[1]?.opponent;
          const team1Name = team1?.name || 'Chưa xác định';
          const team2Name = team2?.name || 'Chưa xác định';
          const team1Logo = team1?.image_url || 'https://via.placeholder.com/24';
          const team2Logo = team2?.image_url || 'https://via.placeholder.com/24';
          const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';
          const tournamentName = getMatchTournamentName(match) || 'Không xác định';
          const team1Score = match.results?.find(r => r.team_id === team1?.id)?.score || 0;
          const team2Score = match.results?.find(r => r.team_id === team2?.id)?.score || 0;
          const currentGame = team1Score + team2Score + 1;

          html += `
            <div class="schedule-item live">
              <div class="match-teams">
                <div class="team-info">
                  <img class="team-logo" src="${team1Logo}" alt="${team1Name} logo">
                  <span>${team1Name}</span>
                </div>
                <div class="match-score">
                  <span class="score">${team1Score}</span>
                  <span class="vs">-</span>
                  <span class="score">${team2Score}</span>
                </div>
                <div class="team-info">
                  <img class="team-logo" src="${team2Logo}" alt="${team2Name} logo">
                  <span>${team2Name}</span>
                </div>
              </div>
              <div class="match-details">
                <span class="match-type">${matchType}</span>
                <span class="followed-match-tournament">${tournamentName}</span>
                <span class="match-status">Đang diễn ra - Ván ${currentGame}</span>
              </div>
            </div>
          `;
        } catch (error) { }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu đang diễn ra</div>';
    }

    html += '<h4>Trận đấu sắp tới</h4>';
    if (upcomingData && upcomingData.length > 0) {
      upcomingData.forEach(match => { html += buildTeamHistoryRow(match, { includeResult: false }); });
    } else {
      html += '<div class="no-matches">Không có trận đấu sắp tới</div>';
    }

    scheduleList.innerHTML = html;
    scheduleList.querySelectorAll('img').forEach(img => { img.addEventListener('error', () => handleImageError(img)); });
  } catch (error) {
    scheduleList.innerHTML = `<div class="error">Lỗi khi tải lịch thi đấu: ${error.message}</div>`;
  }
}

async function displayTournamentSchedule(tournamentId) {
  const tournament = followedTournaments.find(t => t.id === tournamentId);
  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  if (!tournamentScheduleList) return;

  tournamentScheduleList.innerHTML = '<div class="loading">Đang tải lịch thi đấu...</div>';

  try {
    const liveData = await cachedFetch(`${API_URL}/lol/matches/running?filter[league_id]=${tournament.id}&include=opponents.opponent,league,tournament,serie`);
    const upcomingData = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&per_page=5&include=opponents.opponent,league,tournament,serie`);
    const pastData = await cachedFetch(`${API_URL}/lol/matches/past?filter[league_id]=${tournament.id}&per_page=5&include=opponents.opponent,league,tournament,serie`);

    let html = '';

    const buildTournamentRow = (match, statusType) => {
      const opponents = match.opponents?.map(o => o.opponent).filter(Boolean) || [];
      const team1 = opponents[0] || { name: 'Chưa xác định', image_url: 'https://via.placeholder.com/24' };
      const team2 = opponents[1] || { name: 'Chưa xác định', image_url: 'https://via.placeholder.com/24' };

      const team1Logo = team1.image_url || 'https://via.placeholder.com/24';
      const team1Name = team1.acronym || team1.name || 'Chưa xác định';
      const team2Logo = team2.image_url || 'https://via.placeholder.com/24';
      const team2Name = team2.acronym || team2.name || 'Chưa xác định';

      const matchTime = formatDateTime(match.scheduled_at || match.begin_at || match.end_at);
      const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'BO?';

      let detailLine = matchType;
      let boToneClass = 'followed-match-bo--positive';

      if (statusType === 'past') {
        const team1Score = match.results?.find(r => r.team_id === team1.id)?.score ?? '-';
        const team2Score = match.results?.find(r => r.team_id === team2.id)?.score ?? '-';
        detailLine = `${team1Score}-${team2Score}`;
      } else if (statusType === 'live') {
        const team1Score = match.results?.find(r => r.team_id === team1.id)?.score || 0;
        const team2Score = match.results?.find(r => r.team_id === team2.id)?.score || 0;
        detailLine = `${team1Score} - ${team2Score}`;
        boToneClass = 'followed-match-status';
      }

      return `
        <div class="schedule-item ${statusType}">
          <div class="followed-row-inner">
            <div class="followed-team-block">
              <img class="team-logo" src="${team1Logo}" alt="${team1Name} logo">
              <span class="followed-team-name">${team1Name}</span>
            </div>
            <div class="followed-match-detail">
              <div class="followed-match-time">${matchTime}</div>
              <div class="followed-match-extra">
                <span class="followed-match-bo ${boToneClass}">${detailLine}</span>
                <span class="followed-match-tournament">${matchType}</span>
              </div>
            </div>
            <div class="followed-opponent-block">
              <span class="followed-opponent-name">${team2Name}</span>
              <img class="team-logo" src="${team2Logo}" alt="${team2Name} logo">
            </div>
          </div>
        </div>
      `;
    };

    html += '<h4>Trận đấu đã diễn ra</h4>';
    if (pastData && pastData.length > 0) {
      pastData.forEach(match => { html += buildTournamentRow(match, 'past'); });
    } else {
      html += '<div class="no-matches">Không có trận đấu đã diễn ra</div>';
    }

    html += '<h4>Trận đấu đang diễn ra</h4>';
    if (liveData && liveData.length > 0) {
      liveData.forEach(match => { html += buildTournamentRow(match, 'live'); });
    } else {
      html += '<div class="no-matches">Không có trận đấu đang diễn ra</div>';
    }

    html += '<h4>Trận đấu sắp tới</h4>';
    if (upcomingData && upcomingData.length > 0) {
      upcomingData.forEach(match => { html += buildTournamentRow(match, 'upcoming'); });
    } else {
      html += '<div class="no-matches">Không có trận đấu sắp tới</div>';
    }

    tournamentScheduleList.innerHTML = html;
    tournamentScheduleList.querySelectorAll('img').forEach(img => { img.addEventListener('error', () => handleImageError(img)); });
  } catch (error) {
    tournamentScheduleList.innerHTML = `<div class="error">Lỗi khi tải lịch thi đấu: ${error.message}</div>`;
  }
}

async function displayTournamentStandings(leagueId) {
  const tournamentInfo = followedTournaments.find(t => t.id === leagueId);
  const standingsList = document.getElementById('tournamentStandingsList');
  if (!standingsList) return;

  standingsList.innerHTML = '<div class="loading">Đang tải bảng xếp hạng...</div>';

  try {
    const seriesData = await cachedFetch(`${API_URL}/lol/series?filter[league_id]=${leagueId}&sort=-begin_at`);

    if (!seriesData || seriesData.length === 0 || !seriesData[0].tournaments || seriesData[0].tournaments.length === 0) {
      standingsList.innerHTML = '<div class="no-data">Không có dữ liệu giải đấu hiện tại</div>';
      return;
    }

    const actualTournamentId = seriesData[0].tournaments[0].id;
    const data = await cachedFetch(`${API_URL}/tournaments/${actualTournamentId}/standings`);

    if (data && data.length > 0) {
      let html = `
        <div class="standings-header">
          <div class="standings-rank">#</div>
          <div class="standings-team">Đội</div>
          <div class="standings-stats">
            <span>W</span>
            <span>L</span>
            <span>WR</span>
          </div>
        </div>`;

      const sortedData = [...data].sort((a, b) => a.rank - b.rank);

      sortedData.forEach((standing) => {
        const team = standing.team;
        const wins = standing.wins || 0;
        const losses = standing.losses || 0;
        const rank = standing.rank || '-';
        const totalMatches = wins + losses;
        const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;

        html += `
          <div class="standings-item">
            <div class="standings-rank">${rank}</div>
            <div class="standings-team">
              <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${team.name} logo" onerror="this.src='https://via.placeholder.com/24'">
              <span class="team-name">${team.name}</span>
            </div>
            <div class="standings-stats">
              <span>${wins}</span>
              <span>${losses}</span>
              <span>${winRate}%</span>
            </div>
          </div>`;
      });
      standingsList.innerHTML = html;
    } else {
      standingsList.innerHTML = '<div class="no-data">Không có dữ liệu bảng xếp hạng</div>';
    }
  } catch (error) {
    standingsList.innerHTML = `<div class="error">Lỗi khi tải bảng xếp hạng: ${error.message}</div>`;
  }
}

function removeTeam(teamId) {
  followedTeams = followedTeams.filter(team => team.id !== teamId);
  if (selectedTeamId === teamId) selectedTeamId = null;
  saveFollowedTeams();
  displayFollowedTeams();
}

function removeTournament(tournamentId) {
  followedTournaments = followedTournaments.filter(t => t.id !== tournamentId);
  if (selectedTournamentId === tournamentId) selectedTournamentId = null;
  saveFollowedTournaments();
  displayFollowedTournaments();

  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  const tournamentStandingsList = document.getElementById('tournamentStandingsList');
  if (tournamentScheduleList) tournamentScheduleList.innerHTML = '';
  if (tournamentStandingsList) tournamentStandingsList.innerHTML = '';
}

function saveFollowedTeams() { chrome.storage.local.set({ followedTeams }); }
function saveFollowedTournaments() { chrome.storage.local.set({ followedTournaments }); }
