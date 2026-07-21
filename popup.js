let followedTeams = [];
let followedTournaments = [];
let selectedTeamId = null;
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
      await checkMatchesOnPopupOpen(); // Kiểm tra lịch thi đấu khi mở popup
      displayFollowedTeams();
    } else {
      followedTeamsDiv.innerHTML = ''; // Xóa loading nếu không có đội
    }
    if (result.followedTournaments) {
      followedTournaments = result.followedTournaments;
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
      container.querySelector(`#${button.dataset.tab}-tab`).classList.add('active');
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

// Hàm kiểm tra lịch thi đấu khi mở popup
async function checkMatchesOnPopupOpen() {
  try {
    if (!followedTeams || followedTeams.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const matchPromises = followedTeams.map(async (team) => {
      // Kiểm tra trận live
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      if (liveData.length > 0) {
        return { teamId: team.id, match: liveData[0], type: 'live' };
      }

      // Kiểm tra trận upcoming
      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&per_page=1&sort=begin_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      if (upcomingData.length > 0) {
        return { teamId: team.id, match: upcomingData[0], type: 'upcoming' };
      }

      // Lấy trận past gần nhất
      const pastResponse = await fetch(
        `${API_URL}/lol/matches/past?filter[opponent_id]=${team.id}&per_page=1&sort=-end_at&include=${matchInclude}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const pastData = await pastResponse.json();
      if (pastData.length > 0) {
        return { teamId: team.id, match: pastData[0], type: 'past' };
      }

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

// Hàm xử lý lỗi ảnh
function handleImageError(img) {
  img.src = 'https://via.placeholder.com/24';
}

// Hàm tạo HTML cho team (hàng: [logo + tên đội] | thông tin trận | [tên đối thủ + logo])
function createTeamHTML(team) {
  const displayName = team.acronym || team.name;
  const logoUrl = team.image_url || 'https://via.placeholder.com/24';

  const homeBlock = `
    <div class="followed-team-block" data-team-id="${team.id}" data-team-name="${team.name}" data-team-logo="${logoUrl}">
      <img class="team-logo" src="${logoUrl}" alt="${displayName}">
      <span class="followed-team-name">${displayName}</span>
    </div>`;

  let centerBlock;
  let awayBlock;

  if (team.matchData) {
    const opponent = team.matchData.opponent;
    const oppDisplay = opponent?.acronym || opponent?.name || 'Chưa xác định';
    const oppLogo = opponent?.image_url || 'https://via.placeholder.com/24';
    const matchTime = formatDateTime(team.matchData.matchTime);
    const matchType = team.matchData.numberOfGames ? `BO${team.matchData.numberOfGames}` : '—';
    const tournamentName = team.matchData.tournamentName || 'Không xác định';
    const status = team.matchData.status === 'Sắp diễn ra' ? '' : (team.matchData.status || '');

    centerBlock = `
      <div class="followed-match-detail">
        <div class="followed-match-time">${matchTime}</div>
        <div class="followed-match-extra">
          <span class="followed-match-bo">${matchType}</span>
          <span class="followed-match-tournament">${tournamentName}</span>
          ${status ? `<span class="followed-match-status">${status}</span>` : ''}
        </div>
      </div>`;

    awayBlock = `
      <div class="followed-opponent-block" data-opponent-id="${opponent?.id || ''}" data-opponent-name="${opponent?.name || 'Chưa xác định'}" data-opponent-logo="${oppLogo}">
        <span class="followed-opponent-name">${oppDisplay}</span>
        <img class="team-logo" src="${oppLogo}" alt="${oppDisplay}">
      </div>`;
  } else {
    centerBlock = `
      <div class="followed-match-detail followed-match-detail--muted">
        <div class="followed-match-time">—</div>
        <div class="followed-match-extra"><span class="followed-match-bo">Chưa có lịch</span></div>
      </div>`;
    awayBlock = '<div class="followed-opponent-block followed-opponent-block--empty" aria-hidden="true"></div>';
  }

  return `
    <div class="followed-row-inner">
      ${homeBlock}
      ${centerBlock}
      ${awayBlock}
    </div>`;
}

// Hàm tạo HTML cho tournament
function createTournamentHTML(tournament) {
  return `
    <div class="followed-row-inner">
      <div class="tournament-name followed-team-block">
        <img class="tournament-logo team-logo" src="${tournament.image_url || 'https://via.placeholder.com/24'}" alt="${tournament.name} logo">
        <span class="tournament-name-text followed-team-name">${tournament.name}</span>
      </div>
      <div class="followed-match-detail followed-match-detail--muted tournament-center-placeholder">
        <div class="followed-match-time">—</div>
      </div>
      <div class="followed-opponent-block followed-opponent-block--empty tournament-opponent-placeholder" aria-hidden="true"></div>
    </div>
  `;
}

// Hàm tiện ích để định dạng thời gian
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
        teamElement.innerHTML = createTeamHTML(team) + `<button class="add-team" data-team-id="${team.id}">+</button>`;
        const img = teamElement.querySelector('.team-logo');
        img.addEventListener('error', () => handleImageError(img));
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
      alert('Không tìm thấy đội tuyển nào. Vui lòng thử tìm kiếm với tên đầy đủ hoặc tên viết tắt khác.\nVí dụ: "Gen.G" hoặc "GenG"');
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm đội:', error);
    alert('Có lỗi xảy ra khi tìm kiếm đội. Vui lòng thử lại sau.');
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
        tournamentElement.innerHTML = createTournamentHTML(tournament) + `<button class="add-tournament" data-tournament-id="${tournament.id}">+</button>`;
        const img = tournamentElement.querySelector('.tournament-logo');
        img.addEventListener('error', () => handleImageError(img));
        tournamentElement.querySelector('.add-tournament').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!followedTournaments.some(t => t.id === tournament.id)) {
            followedTournaments.push(tournament);
            saveFollowedTournaments();
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
      alert('Không tìm thấy giải đấu nào. Vui lòng thử tìm kiếm với tên khác.\nVí dụ: "LCK" hoặc "Worlds"');
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm giải đấu:', error);
    alert('Có lỗi xảy ra khi tìm kiếm giải đấu. Vui lòng thử lại sau.');
  }
}

// Hàm hiển thị danh sách đội đang theo dõi
function displayFollowedTeams() {
  const followedTeamsDiv = document.getElementById('followedTeams');
  
  // Logic Sắp xếp: Live -> Upcoming (sớm nhất trước) -> Past/None
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

    // 1. Sắp xếp theo nhóm ưu tiên
    if (priorityA !== priorityB) return priorityA - priorityB;

    // 2. Sắp xếp chi tiết trong cùng một nhóm
    if (priorityA === 2) { 
      // Sắp diễn ra: Trận gần nhất (thời gian nhỏ hơn) lên đầu
      return new Date(a.matchData.matchTime) - new Date(b.matchData.matchTime);
    }
    if (priorityA === 3) {
      // Đã kết thúc: Trận vừa mới đánh xong (thời gian lớn hơn) lên đầu
      return new Date(b.matchData.matchTime) - new Date(a.matchData.matchTime);
    }
    return 0;
  });

  followedTeamsDiv.innerHTML = sortedTeams.length === 0
    ? '<div class="no-data">Chưa theo dõi đội nào</div>'
    : sortedTeams.map(team => {
        const html = createTeamHTML(team);
        const hasMatchToday = team.matchData && isToday(team.matchData.matchTime) && team.matchData.type !== 'past';
        const todayClass = hasMatchToday ? 'match-today' : '';
        const selectedClass = selectedTeamId === team.id ? 'selected' : '';
        
        return `
          <div class="team-item ${todayClass} ${selectedClass}" data-team-id="${team.id}">
            ${html}
            <span class="remove-team" data-team-id="${team.id}">✖</span>
          </div>`;
      }).join('');

  // Gán lại các sự kiện: click logo/tên đội theo dõi → lịch đội đó; click đối thủ → lịch đối thủ
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

  followedTournamentsDiv.innerHTML = followedTournaments.map(tournament => `
    <div class="tournament-item" data-tournament-id="${tournament.id}">
      ${createTournamentHTML(tournament)}
      <span class="remove-tournament" data-tournament-id="${tournament.id}">✖</span>
    </div>
  `).join('');

  // Xử lý sự kiện khi click vào một giải đấu cụ thể
  followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-tournament')) return;

      const tournamentId = parseInt(item.dataset.tournamentId);
      
      // Đánh dấu giải đấu đang được chọn (tùy chọn CSS)
      followedTournamentsDiv.querySelectorAll('.tournament-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      
      // 🔄 KÍCH HOẠT HIỂN THỊ ĐỒNG THỜI CẢ 2 TAB
      displayTournamentSchedule(tournamentId);
      displayTournamentStandings(tournamentId);
    });
  });

  // Sự kiện xóa giải đấu
  followedTournamentsDiv.querySelectorAll('.remove-tournament').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTournament(parseInt(button.dataset.tournamentId));
    });
  });
}

// Cập nhật logic chuyển đổi Tab (Dùng chung cho toàn bộ giao diện)
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabId = button.dataset.tab;
    const container = button.closest('.tabs').parentElement;

    // Chỉ thực hiện chuyển đổi giao diện, không gọi API tại đây
    container.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    button.classList.add('active');
    const targetContent = document.getElementById(`${tabId}-tab`);
    if (targetContent) targetContent.classList.add('active');
  });
});

// Hàm hiển thị lịch thi đấu của đội
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
      if (teamResponse.ok) {
        team = await teamResponse.json();
      }
    }
    if (!team) {
      team = { name: 'Đội tuyển', image_url: null };
    }

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

    let html = `
      <h3>
        <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${team.name} logo" onerror="this.src='https://via.placeholder.com/24'">
        ${team.name}
      </h3>`;

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

    if (liveData && liveData.length > 0) {
      html += '<h4>Trận đấu đang diễn ra</h4>';
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
        } catch (error) {
          console.error('Error processing live match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu đang diễn ra</div>';
    }

    const filteredPastData = (pastData || []).filter(match => {
      const opponents = match.opponents?.map(o => o.opponent).filter(Boolean) || [];
      const selectedOpponent = opponents.find(o => o?.id === teamId) || team;
      const otherOpponent = opponents.find(o => o?.id !== teamId) || null;
      const teamAScore = match.results?.find(r => r.team_id === selectedOpponent?.id)?.score ?? 0;
      const teamBScore = match.results?.find(r => r.team_id === otherOpponent?.id)?.score ?? 0;
      return !(teamAScore === 0 && teamBScore === 0);
    });
    const reversedPastData = [...filteredPastData].reverse();

    if (reversedPastData.length > 0) {
      html += '<h4>Trận đấu gần đây</h4>';
      reversedPastData.forEach(match => {
        try {
          html += buildTeamHistoryRow(match, { includeResult: true });
        } catch (error) {
          console.error('Error processing past match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu gần đây</div>';
    }

    if (upcomingData && upcomingData.length > 0) {
      html += '<h4>Trận đấu sắp tới</h4>';
      upcomingData.forEach(match => {
        try {
          html += buildTeamHistoryRow(match, { includeResult: false });
        } catch (error) {
          console.error('Error processing upcoming match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu sắp tới</div>';
    }

    scheduleList.innerHTML = html;
    scheduleList.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => handleImageError(img));
    });
  } catch (error) {
    console.error('Error fetching team schedule:', error);
    scheduleList.innerHTML = `<div class="error">Lỗi khi tải lịch thi đấu: ${error.message}</div>`;
  }
}

// Hàm hiển thị bảng xếp hạng của giải
async function displayTournamentStandings(leagueId) {
  const tournamentInfo = followedTournaments.find(t => t.id === leagueId);
  const standingsList = document.getElementById('tournamentStandingsList');
  standingsList.innerHTML = '<div class="loading">Đang tải bảng xếp hạng...</div>';

  try {
    // Bước 1: Lấy series mới nhất của League để lấy tournament_id hiện tại
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

    // Bước 2: Gọi API lấy BXH dựa trên tournament_id thực tế
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
      
      // Sắp xếp tự động theo thứ hạng (rank) trả về từ API
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
    console.error('Error fetching tournament standings:', error);
    standingsList.innerHTML = `<div class="error">Lỗi khi tải bảng xếp hạng: ${error.message}</div>`;
  }
}

// Hàm hiển thị lịch thi đấu của giải
async function displayTournamentSchedule(tournamentId) {
  const tournament = followedTournaments.find(t => t.id === tournamentId);
  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
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

    let html = `
      <h3>
        <img class="tournament-logo" src="${tournament.image_url || 'https://via.placeholder.com/24'}" alt="${tournament.name} logo">
        ${tournament.name}
      </h3>`;
    if (liveData && liveData.length > 0) {
      html += '<h4>Trận đấu đang diễn ra</h4>';
      liveData.forEach(match => {
        try {
          const team1 = match.opponents?.[0]?.opponent;
          const team2 = match.opponents?.[1]?.opponent;
          const team1Name = team1?.name || 'Chưa xác định';
          const team2Name = team2?.name || 'Chưa xác định';
          const team1Logo = team1?.image_url || 'https://via.placeholder.com/24';
          const team2Logo = team2?.image_url || 'https://via.placeholder.com/24';
          const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';
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
                <span class="match-status">Đang diễn ra - Ván ${currentGame}</span>
              </div>
            </div>
          `;
        } catch (error) {
          console.error('Error processing live match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu đang diễn ra</div>';
    }

    if (upcomingData && upcomingData.length > 0) {
      html += '<h4>Trận đấu sắp tới</h4>';
      upcomingData.forEach(match => {
        try {
          const team1 = match.opponents?.[0]?.opponent;
          const team2 = match.opponents?.[1]?.opponent;
          const team1Name = team1?.name || 'Chưa xác định';
          const team2Name = team2?.name || 'Chưa xác định';
          const team1Logo = team1?.image_url || 'https://via.placeholder.com/24';
          const team2Logo = team2?.image_url || 'https://via.placeholder.com/24';
          const matchTime = formatDateTime(match.scheduled_at);
          const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';

          html += `
            <div class="schedule-item upcoming">
              <div class="match-teams">
                <div class="team-info">
                  <img class="team-logo" src="${team1Logo}" alt="${team1Name} logo">
                  <span>${team1Name}</span>
                </div>
                <span class="vs">vs</span>
                <div class="team-info">
                  <img class="team-logo" src="${team2Logo}" alt="${team2Name} logo">
                  <span>${team2Name}</span>
                </div>
              </div>
              <div class="match-time">${matchTime}</div>
              <div class="match-type">${matchType}</div>
            </div>
          `;
        } catch (error) {
          console.error('Error processing upcoming match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu sắp tới</div>';
    }

    if (pastData && pastData.length > 0) {
      html += '<h4>Trận đấu gần đây</h4>';
      pastData.forEach(match => {
        try {
          const team1 = match.opponents?.[0]?.opponent;
          const team2 = match.opponents?.[1]?.opponent;
          const team1Name = team1?.name || 'Chưa xác định';
          const team2Name = team2?.name || 'Chưa xác định';
          const team1Logo = team1?.image_url || 'https://via.placeholder.com/24';
          const team2Logo = team2?.image_url || 'https://via.placeholder.com/24';
          const matchTime = formatDateTime(match.scheduled_at);
          const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';
          const winner = match.winner?.name || 'Chưa có';
          const score = match.results?.map(r => r.score).join(' - ') || 'Chưa có';

          html += `
            <div class="schedule-item past">
              <div class="match-teams">
                <div class="team-info">
                  <img class="team-logo" src="${team1Logo}" alt="${team1Name} logo">
                  <span>${team1Name}</span>
                </div>
                <span class="vs">vs</span>
                <div class="team-info">
                  <img class="team-logo" src="${team2Logo}" alt="${team2Name} logo">
                  <span>${team2Name}</span>
                </div>
              </div>
              <div class="match-time">${matchTime}</div>
              <div class="match-type">${matchType}</div>
              <div class="match-result">Kết quả: ${score}</div>
              <div class="match-winner">Người chiến thắng: ${winner}</div>
            </div>
          `;
        } catch (error) {
          console.error('Error processing past match:', error);
        }
      });
    } else {
      html += '<div class="no-matches">Không có trận đấu gần đây</div>';
    }

    tournamentScheduleList.innerHTML = html;
    tournamentScheduleList.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', () => handleImageError(img));
    });
  } catch (error) {
    console.error('Error fetching tournament schedule:', error);
    tournamentScheduleList.innerHTML = `<div class="error">Lỗi khi tải lịch thi đấu: ${error.message}</div>`;
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
  saveFollowedTournaments();
  displayFollowedTournaments();
  
  // Khóa tab và xóa trắng nội dung cũ nếu cần
  document.getElementById('tournamentScheduleList').innerHTML = '';
  document.getElementById('tournamentStandingsList').innerHTML = '';
}

// Hàm lưu danh sách đội đang theo dõi
function saveFollowedTeams() {
  chrome.storage.local.set({ followedTeams });
}

// Hàm lưu danh sách giải đấu đang theo dõi
function saveFollowedTournaments() {
  chrome.storage.local.set({ followedTournaments });
}