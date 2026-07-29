import { API_URL, cachedFetch, getErrorMessage } from './api.js';
import { followedTeams, followedTournaments } from './state.js';
import { formatDateTime, handleImageError, getMatchTournamentName } from './utils.js';

export async function displayTeamSchedule(teamId) {
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
    scheduleList.innerHTML = `<div class="error">${getErrorMessage(error)}</div>`;
  }
}

export async function displayTournamentSchedule(tournamentId) {
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
    tournamentScheduleList.innerHTML = `<div class="error">${getErrorMessage(error)}</div>`;
  }
}

export async function displayTournamentStandings(leagueId) {
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
    standingsList.innerHTML = `<div class="error">${getErrorMessage(error)}</div>`;
  }
}