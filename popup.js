let followedTeams = [];
let followedTournaments = [];
let selectedTeamId = null;
let selectedTournamentId = null;
const API_KEY = 'GjZzmsBmadIp2qYgdmvMjCr0M3MbPX1qN97Te_qOnuAoMaZcr-E';
const API_URL = 'https://api.pandascore.co';

// Khởi tạo khi popup được mở
document.addEventListener('DOMContentLoaded', async () => {
  const followedTeamsDiv = document.getElementById('followedTeams');
  followedTeamsDiv.innerHTML = '<div class="loading">Đang tải danh sách đội...</div>';

  // Lấy danh sách đội và giải đấu đã theo dõi từ storage
  chrome.storage.local.get(['followedTeams', 'followedTournaments'], async (result) => {
    if (result.followedTeams) {
      followedTeams = result.followedTeams;
      await checkMatchesOnPopupOpen(); // Kiểm tra lịch thi đấu đội khi mở popup
      displayFollowedTeams();
    } else {
      followedTeamsDiv.innerHTML = ''; // Xóa loading nếu không có đội
    }
    if (result.followedTournaments) {
      followedTournaments = result.followedTournaments;
      await checkTournamentMatchesOnPopupOpen(); // Kiểm tra lịch thi đấu giải khi mở popup
      displayFollowedTournaments();
    }
  });

  // Thêm event listeners
  document.getElementById('searchButton').addEventListener('click', searchTeam);
  document.getElementById('teamSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTeam();
  });

  document.getElementById('tournamentSearchButton').addEventListener('click', searchTournament);
  document.getElementById('tournamentSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTournament();
  });

  // Thêm xử lý chuyển đổi tab
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

// Hàm kiểm tra xem ngày có phải hôm nay không
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

// Hàm kiểm tra lịch thi đấu đội khi mở popup
async function checkMatchesOnPopupOpen() {
  try {
    if (!followedTeams || followedTeams.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const matchPromises = followedTeams.map(async (team) => {
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      if (liveData.length > 0) return { teamId: team.id, match: liveData[0], type: 'live' };

      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&per_page=1&sort=begin_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      if (upcomingData.length > 0) return { teamId: team.id, match: upcomingData[0], type: 'upcoming' };

      const pastResponse = await fetch(
        `${API_URL}/lol/matches/past?filter[opponent_id]=${team.id}&per_page=1&sort=-end_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const pastData = await pastResponse.json();
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

// Hàm kiểm tra lịch thi đấu giải đấu khi mở popup
async function checkTournamentMatchesOnPopupOpen() {
  try {
    if (!followedTournaments || followedTournaments.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const matchPromises = followedTournaments.map(async (tournament) => {
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[league_id]=${tournament.id}&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      if (liveData.length > 0) return { tournamentId: tournament.id, match: liveData[0], type: 'live' };

      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&per_page=1&sort=begin_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      if (upcomingData.length > 0) return { tournamentId: tournament.id, match: upcomingData[0], type: 'upcoming' };

      const pastResponse = await fetch(
        `${API_URL}/lol/matches/past?filter[league_id]=${tournament.id}&per_page=1&sort=-end_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const pastData = await pastResponse.json();
      if (pastData.length > 0) return { tournamentId: tournament.id, match: pastData[0], type: 'past' };

      return null;
    });

    const matches = (await Promise.all(matchPromises)).filter(match => match !== null);

    followedTournaments.forEach(tournament => {
      const matchData = matches.find(m => m.tournamentId === tournament.id);
      const opponents = matchData?.match?.opponents?.map(o => o.opponent).filter(Boolean) || [];
      tournament.matchData = matchData ? {
        team1: opponents[0] || null,
        team2: opponents[1] || null,
        matchTime: matchData.match.scheduled_at || matchData.match.begin_at || matchData.match.end_at,
        status: matchData.type === 'live' ? 'Đang diễn ra' : matchData.type === 'upcoming' ? 'Sắp diễn ra' : 'Kết thúc',
        numberOfGames: matchData.match.number_of_games || null
      } : null;
    });
  } catch (error) {
    console.error('Error checking tournament matches on popup open:', error);
  }
}

// Hàm xử lý lỗi ảnh
function handleImageError(img) {
  img.src = 'https://via.placeholder.com/24';
}

// Hàm tạo HTML dùng chung cho Đội tuyển
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

// Hàm tạo HTML hiển thị hàng giải đấu đang theo dõi
function createTournamentFollowedItemHTML(tournament) {
  const matchData = tournament.matchData;
  const tournamentName = tournament.acronym || tournament.name;
  const tournamentLogo = tournament.image_url || 'https://via.placeholder.com/24';

  const leftBlock = `
    <div class="followed-team-block">
      <img class="tournament-logo team-logo" src="${tournamentLogo}" alt="${tournamentName}">
      <span class="followed-team-name">${tournamentName}</span>
    </div>`;

  if (!matchData || !matchData.team1 || !matchData.team2) {
    return `
      <div class="followed-row-inner">
        ${leftBlock}
        <div class="followed-match-detail followed-match-detail--muted">
          <div class="followed-match-time">—</div>
          <div class="followed-match-extra"><span class="followed-match-bo">Chưa có lịch</span></div>
        </div>
        <div class="followed-opponent-block followed-opponent-block--empty" aria-hidden="true"></div>
      </div>`;
  }

  const team1 = matchData.team1;
  const team2 = matchData.team2;
  const team1Display = team1.acronym || team1.name || '';
  const team2Display = team2.acronym || team2.name || '';
  const matchTime = formatDateTime(matchData.matchTime);
  const matchType = matchData.numberOfGames ? `BO${matchData.numberOfGames}` : '—';
  const status = matchData.status === 'Sắp diễn ra' ? '' : (matchData.status || '');

  const centerBlock = `
    <div class="followed-match-detail">
      <div class="followed-match-time">${matchTime}</div>
      <div class="followed-match-extra">
        <span class="followed-match-bo">${matchType}</span>
        ${status ? `<span class="followed-match-status">${status}</span>` : ''}
      </div>
    </div>`;

  const rightBlock = `
    <div class="followed-opponent-block">
      <span class="followed-opponent-name" style="font-size: 11px;">${team1Display} vs ${team2Display}</span>
    </div>`;

  return `
    <div class="followed-row-inner">
      ${leftBlock}
      ${centerBlock}
      ${rightBlock}
    </div>`;
}

// Hàm tiện ích định dạng thời gian
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

// Hàm tìm kiếm đội tuyển
async function searchTeam() {
  const searchInput = document.getElementById('teamSearch');
  const teamName = searchInput.value.trim();
  if (!teamName) return;

  const oldSearchResults = document.querySelector('.search-results');
  if (oldSearchResults) oldSearchResults.remove();

  try {
    let response = await fetch(`${API_URL}/lol/teams?search[name]=${encodeURIComponent(teamName)}&per_page=10`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    let data = await response.json();

    if (data.length === 0) {
      response = await fetch(`${API_URL}/lol/teams?search[acronym]=${encodeURIComponent(teamName)}&per_page=10`, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
        mode: 'cors'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      data = await response.json();
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

// Hàm tìm kiếm giải đấu
async function searchTournament() {
  const searchInput = document.getElementById('tournamentSearch');
  const tournamentName = searchInput.value.trim();
  if (!tournamentName) return;

  const oldSearchResults = document.querySelector('.search-results');
  if (oldSearchResults) oldSearchResults.remove();

  try {
    let response = await fetch(`${API_URL}/lol/tournaments?search[name]=${encodeURIComponent(tournamentName)}&per_page=10`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    let data = await response.json();

    if (data.length === 0) {
      response = await fetch(`${API_URL}/lol/leagues?search[name]=${encodeURIComponent(tournamentName)}&per_page=10`, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
        mode: 'cors'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      data = await response.json();
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

// Hàm hiển thị danh sách đội đang theo dõi
function displayFollowedTeams() {
  const followedTeamsDiv = document.getElementById('followedTeams');
  
  const sortedTeams = [...followedTeams].sort((a, b) => {
    const getPriority = (team) => {
      if (!team.matchData) return 4;
      const status = team.matchData.status;
      if (status === 'Đang diễn ra') return 1;
      if (status === 'Sắp diễn ra') return 2;
      if (status === 'Kết thúc') return 3;
      return 4;
    };

    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    if (priorityA !== priorityB) return priorityA - priorityB;

    if (priorityA === 2) { 
      return new Date(a.matchData.matchTime) - new Date(b.matchData.matchTime);
    }
    if (priorityA === 3) {
      return new Date(b.matchData.matchTime) - new Date(a.matchData.matchTime);
    }
    return 0;
  });

  followedTeamsDiv.innerHTML = sortedTeams.length === 0
    ? '<div class="no-data">Chưa theo dõi đội nào</div>'
    : sortedTeams.map(team => {
        const html = createFollowedItemHTML(team, 'team');
        const hasMatchToday = team.matchData && isToday(team.matchData.matchTime) && team.matchData.type !== 'past';
        const todayClass = hasMatchToday ? 'match-today' : '';
        const selectedClass = selectedTeamId === team.id ? 'selected' : '';
        
        return `
          <div class="team-item ${todayClass} ${selectedClass}" data-team-id="${team.id}">
            ${html}
            <span class="remove-team" data-team-id="${team.id}">✖</span>
          </div>`;
      }).join('');

  followedTeamsDiv.querySelectorAll('.team-item img.team-logo').forEach(img => {
    img.addEventListener('error', () => handleImageError(img));
  });

  followedTeamsDiv.querySelectorAll('.team-item').forEach(el => {
    const followedId = parseInt(el.dataset.teamId, 10);
    el.querySelector('.followed-team-block')?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTeamId = followedId;
      displayFollowedTeams();
      displayTeamSchedule(followedId);
    });
    const opponentEl = el.querySelector('.followed-opponent-block:not(.followed-opponent-block--empty)');
    if (opponentEl) {
      opponentEl.addEventListener('click', (e) => {
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

// Hàm hiển thị danh sách giải đấu đang theo dõi
function displayFollowedTournaments() {
  const followedTournamentsDiv = document.getElementById('followedTournaments');
  
  if (followedTournaments.length === 0) {
    followedTournamentsDiv.innerHTML = '<div class="no-data">Chưa theo dõi giải đấu nào</div>';
    return;
  }

  const sortedTournaments = [...followedTournaments].sort((a, b) => {
    const getPriority = (item) => {
      if (!item.matchData) return 4;
      const status = item.matchData.status;
      if (status === 'Đang diễn ra') return 1;
      if (status === 'Sắp diễn ra') return 2;
      if (status === 'Kết thúc') return 3;
      return 4;
    };

    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    if (priorityA !== priorityB) return priorityA - priorityB;

    if (priorityA === 2) { 
      return new Date(a.matchData.matchTime) - new Date(b.matchData.matchTime);
    }
    if (priorityA === 3) {
      return new Date(b.matchData.matchTime) - new Date(a.matchData.matchTime);
    }
    return 0;
  });

  followedTournamentsDiv.innerHTML = sortedTournaments.map(tournament => {
    const html = createTournamentFollowedItemHTML(tournament);
    const hasMatchToday = tournament.matchData && isToday(tournament.matchData.matchTime) && tournament.matchData.status !== 'Kết thúc';
    const todayClass = hasMatchToday ? 'match-today' : '';
    const selectedClass = selectedTournamentId === tournament.id ? 'selected' : '';

    return `
      <div class="tournament-item ${todayClass} ${selectedClass}" data-tournament-id="${tournament.id}">
        ${html}
        <span class="remove-team remove-tournament" data-tournament-id="${tournament.id}">✖</span>
      </div>`;
  }).join('');

  followedTournamentsDiv.querySelectorAll('.tournament-item img.team-logo').forEach(img => {
    img.addEventListener('error', () => handleImageError(img));
  });

  followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(item => {
    const tournamentId = parseInt(item.dataset.tournamentId, 10);
    item.addEventListener('click', (e) => {
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

// Hàm hiển thị lịch thi đấu của đội (Thứ tự: gần đây -> đang diễn ra -> sắp tới)
async function displayTeamSchedule(teamId) {
  const scheduleList = document.getElementById('scheduleList');
  const scheduleSection = document.querySelector('.schedule-section');
  scheduleSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  scheduleList.innerHTML = '<div class="loading">Đang tải lịch thi đấu...</div>';

  try {
    let team = followedTeams.find(t => t.id === teamId);
    if (!team) {
      const teamResponse = await fetch(`${API_URL}/teams/${teamId}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
      });
      if (teamResponse.ok) team = await teamResponse.json();
    }
    if (!team) team = { name: 'Đội tuyển', image_url: null };

    const liveResponse = await fetch(`${API_URL}/lol/matches/running?filter[opponent_id]=${teamId}&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const liveData = await liveResponse.json();

    const upcomingResponse = await fetch(`${API_URL}/lol/matches/upcoming?filter[opponent_id]=${teamId}&per_page=5&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const upcomingData = await upcomingResponse.json();

    const pastResponse = await fetch(`${API_URL}/lol/matches/past?filter[opponent_id]=${teamId}&per_page=5&sort=-end_at&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const pastData = await pastResponse.json();

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
        } catch (error) {}
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

// Hàm hiển thị lịch thi đấu của giải
async function displayTournamentSchedule(tournamentId) {
  const tournament = followedTournaments.find(t => t.id === tournamentId);
  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  if (!tournamentScheduleList) return;
  
  tournamentScheduleList.innerHTML = '<div class="loading">Đang tải lịch thi đấu...</div>';

  try {
    const liveResponse = await fetch(`${API_URL}/lol/matches/running?filter[league_id]=${tournament.id}&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const liveData = await liveResponse.json();

    const upcomingResponse = await fetch(`${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&per_page=5&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const upcomingData = await upcomingResponse.json();

    const pastResponse = await fetch(`${API_URL}/lol/matches/past?filter[league_id]=${tournament.id}&per_page=5&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const pastData = await pastResponse.json();

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

// Hàm hiển thị bảng xếp hạng của giải
async function displayTournamentStandings(leagueId) {
  const tournamentInfo = followedTournaments.find(t => t.id === leagueId);
  const standingsList = document.getElementById('tournamentStandingsList');
  if (!standingsList) return;
  
  standingsList.innerHTML = '<div class="loading">Đang tải bảng xếp hạng...</div>';

  try {
    const seriesResponse = await fetch(`${API_URL}/lol/series?filter[league_id]=${leagueId}&sort=-begin_at`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    if (!seriesResponse.ok) throw new Error(`HTTP error! status: ${seriesResponse.status}`);
    const seriesData = await seriesResponse.json();

    if (!seriesData || seriesData.length === 0 || !seriesData[0].tournaments || seriesData[0].tournaments.length === 0) {
      standingsList.innerHTML = '<div class="no-data">Không có dữ liệu giải đấu hiện tại</div>';
      return;
    }

    const actualTournamentId = seriesData[0].tournaments[0].id;
    const standingsResponse = await fetch(`${API_URL}/tournaments/${actualTournamentId}/standings`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    if (!standingsResponse.ok) throw new Error(`HTTP error! status: ${standingsResponse.status}`);
    const data = await standingsResponse.json();

    if (data && data.length > 0) {
      let html = `
        <h3>
          <img class="tournament-logo" src="${tournamentInfo.image_url || 'https://via.placeholder.com/24'}" alt="${tournamentInfo.name} logo" onerror="this.src='https://via.placeholder.com/24'">
          ${tournamentInfo.name}
        </h3>
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

// Hàm xóa đội khỏi danh sách theo dõi
function removeTeam(teamId) {
  followedTeams = followedTeams.filter(team => team.id !== teamId);
  if (selectedTeamId === teamId) selectedTeamId = null;
  saveFollowedTeams();
  displayFollowedTeams();
}

// Hàm xóa giải đấu khỏi danh sách theo dõi
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

// Hàm lưu dữ liệu
function saveFollowedTeams() { chrome.storage.local.set({ followedTeams }); }
function saveFollowedTournaments() { chrome.storage.local.set({ followedTournaments }); }