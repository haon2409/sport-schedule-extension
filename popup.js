// Khởi tạo các biến
let followedTeams = [];
let followedTournaments = [];
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

// Hàm kiểm tra lịch thi đấu khi mở popup
async function checkMatchesOnPopupOpen() {
  try {
    if (!followedTeams || followedTeams.length === 0) return;

    const matchPromises = followedTeams.map(async (team) => {
      // Kiểm tra trận live
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}&include=opponents.opponent`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      if (liveData.length > 0) {
        return { teamId: team.id, match: liveData[0], type: 'live' };
      }

      // Kiểm tra trận upcoming
      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&per_page=1&sort=begin_at&include=opponents.opponent`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      if (upcomingData.length > 0) {
        return { teamId: team.id, match: upcomingData[0], type: 'upcoming' };
      }

      // Lấy trận past gần nhất
      const pastResponse = await fetch(
        `${API_URL}/lol/matches/past?filter[opponent_id]=${team.id}&per_page=1&sort=-end_at&include=opponents.opponent`,
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
        status: matchData.type === 'live' ? 'Đang diễn ra' : matchData.type === 'upcoming' ? 'Sắp diễn ra' : 'Kết thúc'
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

// Hàm tạo HTML cho team
function createTeamHTML(team) {
  let matchInfo = '';
  if (team.matchData) {
    const opponent = team.matchData.opponent;
    const opponentDisplayName = opponent?.acronym || opponent?.name || 'Chưa xác định';
    const opponentShortName = opponentDisplayName.length > 5 ? opponentDisplayName.substring(0, 5) + '...' : opponentDisplayName;
    const opponentLogo = opponent?.image_url || 'https://via.placeholder.com/24';
    const matchTime = formatDateTime(team.matchData.matchTime);
    matchInfo = `
      <div class="match-info">
        <div class="match-time">${matchTime}</div>
        <div class="opponent-info" data-opponent-id="${opponent?.id || ''}" data-opponent-name="${opponent?.name || 'Chưa xác định'}" data-opponent-logo="${opponentLogo}">
          <img class="opponent-logo" src="${opponentLogo}" alt="${opponentDisplayName} logo">
          <span class="opponent-name">${opponentShortName}</span>
        </div>
      </div>
    `;
  }

  const displayName = team.acronym || team.name;
  const shortName = displayName.length > 5 ? displayName.substring(0, 5) + '...' : displayName;

  return `
    <div class="team-name" data-team-id="${team.id}" data-team-name="${team.name}" data-team-logo="${team.image_url || 'https://via.placeholder.com/24'}">
      <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${displayName} logo">
      <span class="team-name-text">${shortName}</span>
    </div>
    ${matchInfo}
  `;
}

// Hàm tạo HTML cho tournament
function createTournamentHTML(tournament) {
  return `
    <div class="tournament-name">
      <img class="tournament-logo" src="${tournament.image_url || 'https://via.placeholder.com/24'}" alt="${tournament.name} logo">
      <span class="tournament-name-text">${tournament.name}</span>
    </div>
  `;
}

// Hàm tiện ích để định dạng thời gian
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const isSameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (isSameDay) {
    return `${hours}:${minutes}`;
  } else {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const weekday = weekdays[date.getDay()];
    return `${hours}:${minutes}, ${weekday}, ${day}/${month}`;
  }
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
  if (!teamName) return;

  const oldSearchResults = document.querySelector('.tournament-search-results');
  if (oldSearchResults) oldSearchResults.remove();

  try {
    const response = await fetch(`${API_URL}/lol/leagues?search[slug]=${encodeURIComponent(tournamentName.toLowerCase())}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data.length > 0) {
      const searchResults = document.createElement('div');
      searchResults.className = 'search-results tournament-search-results';
      searchResults.innerHTML = '<h3>Kết quả tìm kiếm:</h3>';
      data.forEach(league => {
        const leagueElement = document.createElement('div');
        leagueElement.className = 'tournament-item';
        leagueElement.innerHTML = createTournamentHTML(league) + `<button class="add-team" data-tournament-id="${league.id}">+</button>`;
        const img = leagueElement.querySelector('.tournament-logo');
        img.addEventListener('error', () => handleImageError(img));
        leagueElement.querySelector('.add-team').addEventListener('click', (e) => {
          e.stopPropagation();
          if (!followedTournaments.some(t => t.id === league.id)) {
            followedTournaments.push(league);
            saveFollowedTournaments();
            displayFollowedTournaments();
            searchResults.remove();
            searchInput.value = '';
          }
        });
        searchResults.appendChild(leagueElement);
      });
      const followedTournamentsDiv = document.getElementById('followedTournaments');
      followedTournamentsDiv.parentNode.insertBefore(searchResults, followedTournamentsDiv);
    } else {
      const nameResponse = await fetch(`${API_URL}/lol/leagues?search[name]=${encodeURIComponent(tournamentName)}`, {
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
        mode: 'cors'
      });
      if (!nameResponse.ok) throw new Error(`HTTP error! status: ${nameResponse.status}`);
      const nameData = await nameResponse.json();

      if (nameData.length > 0) {
        const searchResults = document.createElement('div');
        searchResults.className = 'search-results tournament-search-results';
        searchResults.innerHTML = '<h3>Kết quả tìm kiếm:</h3>';
        nameData.forEach(league => {
          const leagueElement = document.createElement('div');
          leagueElement.className = 'tournament-item';
          leagueElement.innerHTML = createTournamentHTML(league) + `<button class="add-team" data-tournament-id="${league.id}">+</button>`;
          const img = leagueElement.querySelector('.tournament-logo');
          img.addEventListener('error', () => handleImageError(img));
          leagueElement.querySelector('.add-team').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!followedTournaments.some(t => t.id === league.id)) {
              followedTournaments.push(league);
              saveFollowedTournaments();
              displayFollowedTournaments();
              searchResults.remove();
              searchInput.value = '';
            }
          });
          searchResults.appendChild(leagueElement);
        });
        const followedTournamentsDiv = document.getElementById('followedTournaments');
        followedTournamentsDiv.parentNode.insertBefore(searchResults, followedTournamentsDiv);
      } else {
        alert('Không tìm thấy giải đấu nào. Vui lòng thử tìm kiếm với tên đầy đủ hoặc tên viết tắt khác.\nVí dụ: "LCK Spring 2024" hoặc "LCK"');
      }
    }
  } catch (error) {
    console.error('Lỗi khi tìm kiếm giải đấu:', error);
    alert('Có lỗi xảy ra khi tìm kiếm giải đấu. Vui lòng thử lại sau.');
  }
}

// Hàm hiển thị danh sách đội đang theo dõi
function displayFollowedTeams() {
  const followedTeamsDiv = document.getElementById('followedTeams');
  followedTeamsDiv.innerHTML = '';

  followedTeams.forEach(team => {
    const teamElement = document.createElement('div');
    teamElement.className = 'team-item';
    teamElement.dataset.teamId = team.id;
    teamElement.innerHTML = createTeamHTML(team) + `<span class="remove-team" data-team-id="${team.id}">×</span>`;
    
    const img = teamElement.querySelector('.team-logo');
    img.addEventListener('error', () => handleImageError(img));
    const opponentImg = teamElement.querySelector('.opponent-logo');
    if (opponentImg) opponentImg.addEventListener('error', () => handleImageError(opponentImg));
    
    const teamNameElement = teamElement.querySelector('.team-name');
    teamNameElement.addEventListener('click', (e) => {
      e.stopPropagation();
      showTeamSchedule({
        id: teamNameElement.dataset.teamId,
        name: teamNameElement.dataset.teamName,
        image_url: teamNameElement.dataset.teamLogo
      });
    });

    teamElement.querySelector('.remove-team').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTeam(team.id);
    });

    const opponentInfo = teamElement.querySelector('.opponent-info');
    if (opponentInfo) {
      opponentInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        const opponentId = opponentInfo.dataset.opponentId;
        const opponentName = opponentInfo.dataset.opponentName;
        const opponentLogo = opponentInfo.dataset.opponentLogo;
        if (opponentId && opponentName !== 'Chưa xác định') {
          showTeamSchedule({
            id: opponentId,
            name: opponentName,
            image_url: opponentLogo
          });
        }
      });
    }
    
    followedTeamsDiv.appendChild(teamElement);
  });
}

// Hàm hiển thị danh sách giải đấu đang theo dõi
function displayFollowedTournaments() {
  const followedTournamentsDiv = document.getElementById('followedTournaments');
  followedTournamentsDiv.innerHTML = '';

  followedTournaments.forEach(tournament => {
    const tournamentElement = document.createElement('div');
    tournamentElement.className = 'tournament-item';
    tournamentElement.dataset.tournamentId = tournament.id;
    tournamentElement.innerHTML = createTournamentHTML(tournament) + `<span class="remove-tournament" data-tournament-id="${tournament.id}">×</span>`;
    
    const img = tournamentElement.querySelector('.tournament-logo');
    img.addEventListener('error', () => handleImageError(img));
    
    tournamentElement.querySelector('.tournament-name').addEventListener('click', () => showTournamentSchedule(tournament));
    tournamentElement.querySelector('.remove-tournament').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTournament(tournament.id);
    });
    
    followedTournamentsDiv.appendChild(tournamentElement);
  });
}

// Hàm hiển thị lịch thi đấu của đội
async function showTeamSchedule(team) {
  document.querySelectorAll('.team-item').forEach(item => item.classList.remove('selected'));
  const selectedTeam = document.querySelector(`.team-item[data-team-id="${team.id}"]`);
  if (selectedTeam) selectedTeam.classList.add('selected');

  const scheduleList = document.getElementById('scheduleList');
  scheduleList.innerHTML = '<div class="loading">Đang tải lịch thi đấu...</div>';

  try {
    const liveResponse = await fetch(`${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const liveData = await liveResponse.json();

    const upcomingResponse = await fetch(`${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&per_page=5&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const upcomingData = await upcomingResponse.json();

    const pastResponse = await fetch(`${API_URL}/lol/matches/past?filter[opponent_id]=${team.id}&per_page=5&include=opponents.opponent,league,tournament,serie`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    const pastData = await pastResponse.json();

    const contentContainer = document.createElement('div');
    const title = document.createElement('h3');
    const teamLogo = document.createElement('img');
    teamLogo.className = 'team-logo';
    teamLogo.src = team.image_url || 'https://via.placeholder.com/24';
    teamLogo.alt = `${team.name} logo`;
    teamLogo.addEventListener('error', () => handleImageError(teamLogo));
    title.appendChild(teamLogo);
    title.appendChild(document.createTextNode(team.name));
    contentContainer.appendChild(title);

    if (liveData && liveData.length > 0) {
      const liveTitle = document.createElement('h4');
      liveTitle.textContent = 'Trận đấu đang diễn ra';
      contentContainer.appendChild(liveTitle);
      liveData.forEach(match => {
        const opponent = match.opponents.find(o => o.opponent.id !== team.id)?.opponent;
        const opponentName = opponent?.name || 'Chưa xác định';
        const opponentLogo = opponent?.image_url || 'https://via.placeholder.com/24';
        const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';
        const teamScore = match.results?.find(r => r.team_id === team.id)?.score || 0;
        const opponentScore = match.results?.find(r => r.team_id !== team.id)?.score || 0;
        const currentGame = teamScore + opponentScore + 1;

        const matchElement = document.createElement('div');
        matchElement.className = 'schedule-item live';
        matchElement.innerHTML = `
          <div class="match-teams">
            <div class="team-info">
              <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${team.name} logo">
              <span>${team.name}</span>
            </div>
            <div class="match-score">
              <span class="score">${teamScore}</span>
              <span class="vs">-</span>
              <span class="score">${opponentScore}</span>
            </div>
            <div class="team-info">
              <img class="team-logo" src="${opponentLogo}" alt="${opponentName} logo">
              <span>${opponentName}</span>
            </div>
          </div>
          <div class="match-details">
            <span class="match-type">${matchType}</span>
            <span class="match-status">Đang diễn ra - Ván ${currentGame}</span>
          </div>
        `;
        matchElement.querySelectorAll('img').forEach(img => {
          img.addEventListener('error', () => handleImageError(img));
        });
        contentContainer.appendChild(matchElement);
      });
    } else {
      const noMatches = document.createElement('div');
      noMatches.className = 'no-matches';
      noMatches.textContent = 'Không có trận đấu đang diễn ra';
      contentContainer.appendChild(noMatches);
    }

    if (upcomingData && upcomingData.length > 0) {
      const upcomingTitle = document.createElement('h4');
      upcomingTitle.textContent = 'Trận đấu sắp tới';
      contentContainer.appendChild(upcomingTitle);
      upcomingData.forEach(match => {
        const opponent = match.opponents.find(o => o.opponent.id !== team.id)?.opponent;
        const opponentName = opponent?.name || 'Chưa xác định';
        const opponentLogo = opponent?.image_url || 'https://via.placeholder.com/24';
        const matchTime = formatDateTime(match.scheduled_at);
        const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';

        const matchElement = document.createElement('div');
        matchElement.className = 'schedule-item upcoming';
        matchElement.innerHTML = `
          <div class="match-teams">
            <div class="team-info">
              <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${team.name} logo">
              <span>${team.name}</span>
            </div>
            <span class="vs">vs</span>
            <div class="team-info">
              <img class="team-logo" src="${opponentLogo}" alt="${opponentName} logo">
              <span>${opponentName}</span>
            </div>
          </div>
          <div class="match-time">${matchTime}</div>
          <div class="match-type">${matchType}</div>
        `;
        matchElement.querySelectorAll('img').forEach(img => {
          img.addEventListener('error', () => handleImageError(img));
        });
        contentContainer.appendChild(matchElement);
      });
    } else {
      const noMatches = document.createElement('div');
      noMatches.className = 'no-matches';
      noMatches.textContent = 'Không có trận đấu sắp tới';
      contentContainer.appendChild(noMatches);
    }

    if (pastData && pastData.length > 0) {
      const pastTitle = document.createElement('h4');
      pastTitle.textContent = 'Trận đấu gần đây';
      contentContainer.appendChild(pastTitle);
      pastData.forEach(match => {
        const opponent = match.opponents.find(o => o.opponent.id !== team.id)?.opponent;
        const opponentName = opponent?.name || 'Chưa xác định';
        const opponentLogo = opponent?.image_url || 'https://via.placeholder.com/24';
        const matchTime = formatDateTime(match.scheduled_at);
        const matchType = match.number_of_games ? `BO${match.number_of_games}` : 'Chưa xác định';
        const isWinner = match.winner?.id === team.id;
        const score = match.results?.map(r => r.score).join(' - ') || 'Chưa có';

        const matchElement = document.createElement('div');
        matchElement.className = 'schedule-item past';
        matchElement.innerHTML = `
          <div class="match-teams">
            <div class="team-info">
              <img class="team-logo" src="${team.image_url || 'https://via.placeholder.com/24'}" alt="${team.name} logo">
              <span>${team.name}</span>
            </div>
            <span class="vs">vs</span>
            <div class="team-info">
              <img class="team-logo" src="${opponentLogo}" alt="${opponentName} logo">
              <span>${opponentName}</span>
            </div>
          </div>
          <div class="match-time">${matchTime}</div>
          <div class="match-type">${matchType}</div>
          <div class="match-result">Kết quả: ${score}</div>
          <div class="match-winner">${isWinner ? 'Chiến thắng' : 'Thất bại'}</div>
        `;
        matchElement.querySelectorAll('img').forEach(img => {
          img.addEventListener('error', () => handleImageError(img));
        });
        contentContainer.appendChild(matchElement);
      });
    } else {
      const noMatches = document.createElement('div');
      noMatches.className = 'no-matches';
      noMatches.textContent = 'Không có trận đấu gần đây';
      contentContainer.appendChild(noMatches);
    }

    scheduleList.innerHTML = '';
    scheduleList.appendChild(contentContainer);
  } catch (error) {
    console.error('Error fetching team schedule:', error);
    scheduleList.innerHTML = `<div class="error">Lỗi khi tải lịch thi đấu: ${error.message}</div>`;
  }
}

// Hàm hiển thị lịch thi đấu của giải
async function showTournamentSchedule(tournament) {
  document.querySelectorAll('.tournament-item').forEach(item => item.classList.remove('selected'));
  const selectedTournament = document.querySelector(`.tournament-item[data-tournament-id="${tournament.id}"]`);
  if (selectedTournament) selectedTournament.classList.add('selected');

  const tournamentScheduleTab = document.querySelector('[data-tab="tournament-schedule"]');
  if (tournamentScheduleTab) tournamentScheduleTab.click();

  await displayTournamentSchedule(tournament);
}

// Hàm hiển thị bảng xếp hạng của giải
async function showTournamentStandings(tournament) {
  const standingsList = document.getElementById('tournamentStandingsList');
  standingsList.innerHTML = '<div class="loading">Đang tải bảng xếp hạng...</div>';

  try {
    const response = await fetch(`${API_URL}/lol/tournaments/${tournament.slug}/standings?include=team`, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data && data.length > 0) {
      let html = `
        <h3>
          <img class="tournament-logo" src="${tournament.image_url || 'https://via.placeholder.com/24'}" alt="${tournament.name} logo" onerror="this.src='https://via.placeholder.com/24'">
          ${tournament.name}
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
      const sortedData = [...data].sort((a, b) => (b.wins || 0) - (a.wins || 0));
      sortedData.forEach((standing, index) => {
        const team = standing.team;
        const wins = standing.wins || 0;
        const losses = standing.losses || 0;
        const totalMatches = wins + losses;
        const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0;

        html += `
          <div class="standings-item">
            <div class="standings-rank">${index + 1}</div>
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
async function displayTournamentSchedule(tournament) {
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
  saveFollowedTeams();
  displayFollowedTeams();
}

// Hàm xóa giải đấu khỏi danh sách theo dõi
function removeTournament(tournamentId) {
  followedTournaments = followedTournaments.filter(tournament => tournament.id !== tournamentId);
  saveFollowedTournaments();
  displayFollowedTournaments();
}

// Hàm lưu danh sách đội đang theo dõi
function saveFollowedTeams() {
  chrome.storage.local.set({ followedTeams });
}

// Hàm lưu danh sách giải đấu đang theo dõi
function saveFollowedTournaments() {
  chrome.storage.local.set({ followedTournaments });
}