tournamentElement.addEventListener('drop', handleDrop);
    
    followedTournamentsDiv.appendChild(tournamentElement);
  });
}

// Các hàm xử lý drag & drop
function handleDragStart(e) {
  e.target.classList.add('dragging');
  e.dataTransfer.setData('text/plain', e.target.dataset.teamId || e.target.dataset.tournamentId);
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const draggingElement = document.querySelector('.dragging');
  if (draggingElement && draggingElement !== e.target) {
    const rect = e.target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    e.target.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  const draggedId = e.dataTransfer.getData('text/plain');
  const draggedElement = document.querySelector(`[data-team-id="${draggedId}"], [data-tournament-id="${draggedId}"]`);
  const dropTarget = e.target.closest('.team-item, .tournament-item');
  if (draggedElement && dropTarget && draggedElement !== dropTarget) {
    const container = dropTarget.parentNode;
    const rect = dropTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    if (position === 'before') {
      container.insertBefore(draggedElement, dropTarget);
    } else {
      container.insertBefore(draggedElement, dropTarget.nextSibling);
    }
    const isTeam = draggedElement.classList.contains('team-item');
    const items = isTeam ? followedTeams : followedTournaments;
    const draggedItem = items.find(item => item.id.toString() === draggedId);
    const draggedIndex = items.indexOf(draggedItem);
    const dropIndex = Array.from(container.children).indexOf(dropTarget);
    items.splice(draggedIndex, 1);
    items.splice(position === 'before' ? dropIndex : dropIndex + 1, 0, draggedItem);
    if (isTeam) {
      followedTeams = items;
      chrome.storage.local.set({ followedTeams: items });
    } else {
      followedTournaments = items;
      chrome.storage.local.set({ followedTournaments: items });
    }
  }
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