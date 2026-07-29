import { API_URL, cachedFetch, getErrorMessage } from './api.js';
import {
  followedTournaments, selectedTournamentId, isEditingTournaments, originalFollowedTournaments,
  setFollowedTournaments, setSelectedTournamentId, setIsEditingTournaments, setOriginalFollowedTournaments
} from './state.js';
import { saveFollowedTournaments } from './storage.js';
import { isToday, formatDateTime, handleImageError } from './utils.js';
import { displayTournamentSchedule, displayTournamentStandings } from './schedule.js';
import { icons } from './icons.js';

export function createTournamentFollowedItemHTML(tournament) {
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

export async function checkTournamentMatchesOnPopupOpen() {
  try {
    if (!followedTournaments || followedTournaments.length === 0) return;

    const matchInclude = 'opponents.opponent,league,tournament,serie';

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const startISO = startOfDay.toISOString();
    const endISO = endOfDay.toISOString();

    const matchPromises = followedTournaments.map(async (tournament) => {
      const liveData = await cachedFetch(`${API_URL}/lol/matches/running?filter[league_id]=${tournament.id}&include=${matchInclude}`);
      if (liveData.length > 0) {
        return { tournamentId: tournament.id, matches: liveData, type: 'live' };
      }

      const todayMatches = await cachedFetch(`${API_URL}/lol/matches/upcoming?filter[league_id]=${tournament.id}&range[begin_at]=${startISO},${endISO}&sort=begin_at&include=${matchInclude}`);
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
          matches: matchDataEntry.matches,
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

export async function searchTournament() {
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
        ` + `<button type="button" class="add-tournament" data-tournament-id="${tournament.id}" title="Thêm">${icons.plus}</button>`;

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
    const followedTournamentsDiv = document.getElementById('followedTournaments');
    const old = document.querySelector('.search-results');
    if (old) old.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'search-results';
    errDiv.innerHTML = `<div class="error">${getErrorMessage(error)}</div>`;
    followedTournamentsDiv.parentNode.insertBefore(errDiv, followedTournamentsDiv);
  }
}

export function displayFollowedTournaments() {
  const followedTournamentsDiv = document.getElementById('followedTournaments');

  if (followedTournaments.length === 0) {
    followedTournamentsDiv.innerHTML = '<div class="no-data">Chưa theo dõi giải đấu nào</div>';
    return;
  }

  const sortedTournaments = followedTournaments;

  followedTournamentsDiv.innerHTML = sortedTournaments.map((tournament, index) => {
    const html = createTournamentFollowedItemHTML(tournament);
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
        <button type="button" class="remove-team remove-tournament" data-tournament-id="${tournament.id}" title="Bỏ theo dõi">${icons.x}</button>
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

      setSelectedTournamentId(tournamentId);
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

export function removeTournament(tournamentId) {
  setFollowedTournaments(followedTournaments.filter(t => t.id !== tournamentId));
  if (selectedTournamentId === tournamentId) setSelectedTournamentId(null);
  saveFollowedTournaments();
  displayFollowedTournaments();

  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  const tournamentStandingsList = document.getElementById('tournamentStandingsList');
  if (tournamentScheduleList) tournamentScheduleList.innerHTML = '';
  if (tournamentStandingsList) tournamentStandingsList.innerHTML = '';
}

export function setupTournamentEditButtons() {
  const editTournamentBtn = document.getElementById('editTournamentsBtn');
  const saveTournamentBtn = document.getElementById('saveTournamentsBtn');
  const cancelTournamentBtn = document.getElementById('cancelTournamentsBtn');
  const tournamentActionBtnsDiv = document.getElementById('tournamentEditActionBtns');

  if (editTournamentBtn) {
    editTournamentBtn.addEventListener('click', () => {
      setIsEditingTournaments(true);
      setOriginalFollowedTournaments(JSON.parse(JSON.stringify(followedTournaments)));
      editTournamentBtn.style.display = 'none';
      tournamentActionBtnsDiv.style.display = 'flex';
      displayFollowedTournaments();
    });
  }

  if (cancelTournamentBtn) {
    cancelTournamentBtn.addEventListener('click', () => {
      setIsEditingTournaments(false);
      setFollowedTournaments(JSON.parse(JSON.stringify(originalFollowedTournaments)));
      tournamentActionBtnsDiv.style.display = 'none';
      editTournamentBtn.style.display = '';
      displayFollowedTournaments();
    });
  }

  if (saveTournamentBtn) {
    saveTournamentBtn.addEventListener('click', () => {
      setIsEditingTournaments(false);
      tournamentActionBtnsDiv.style.display = 'none';
      editTournamentBtn.style.display = '';
      saveFollowedTournaments();
      displayFollowedTournaments();
    });
  }
}