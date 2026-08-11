import { API_URL, cachedFetch, getErrorMessage } from './api.js';
import {
  followedTeams, selectedTeamId, isEditingTeams, originalFollowedTeams,
  setFollowedTeams, setSelectedTeamId, setIsEditingTeams, setOriginalFollowedTeams
} from './state.js';
import { saveFollowedTeams } from './storage.js';
import { isToday, formatDateTime, handleImageError, getMatchTournamentName } from './utils.js';
import { displayTeamSchedule } from './schedule.js';
import { icons } from './icons.js';

export function createFollowedItemHTML(item, type = 'team') {
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
    const oppDisplay = opponent?.acronym || opponent?.name || '???';
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

export async function checkMatchesOnPopupOpen() {
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
        tournamentName: getMatchTournamentName(matchData.match) || 'Không xác định',
        type: matchData.type
      } : null;
    });
  } catch (error) {
    console.error('Error checking matches on popup open:', error);
  }
}

export async function searchTeam() {
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
        teamElement.innerHTML = createFollowedItemHTML(team, 'team') + `<button type="button" class="add-team" data-team-id="${team.id}" title="Thêm">${icons.plus}</button>`;
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
    const followedTeamsDiv = document.getElementById('followedTeams');
    const old = document.querySelector('.search-results');
    if (old) old.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'search-results';
    errDiv.innerHTML = `<div class="error">${getErrorMessage(error)}</div>`;
    followedTeamsDiv.parentNode.insertBefore(errDiv, followedTeamsDiv);
  }
}

export function displayFollowedTeams() {
  const followedTeamsDiv = document.getElementById('followedTeams');
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
            <button type="button" class="remove-team" data-team-id="${team.id}" title="Bỏ theo dõi">${icons.x}</button>
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
      setSelectedTeamId(followedId);
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
          setSelectedTeamId(parseInt(oid, 10));
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

export function removeTeam(teamId) {
  setFollowedTeams(followedTeams.filter(team => team.id !== teamId));
  if (selectedTeamId === teamId) setSelectedTeamId(null);
  saveFollowedTeams();
  displayFollowedTeams();
}

export function setupTeamEditButtons() {
  const editBtn = document.getElementById('editTeamsBtn');
  const saveBtn = document.getElementById('saveTeamsBtn');
  const cancelBtn = document.getElementById('cancelTeamsBtn');
  const actionBtnsDiv = document.getElementById('teamEditActionBtns');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      setIsEditingTeams(true);
      setOriginalFollowedTeams(JSON.parse(JSON.stringify(followedTeams)));
      editBtn.style.display = 'none';
      actionBtnsDiv.style.display = 'flex';
      displayFollowedTeams();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      setIsEditingTeams(false);
      setFollowedTeams(JSON.parse(JSON.stringify(originalFollowedTeams)));
      actionBtnsDiv.style.display = 'none';
      editBtn.style.display = '';
      displayFollowedTeams();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      setIsEditingTeams(false);
      actionBtnsDiv.style.display = 'none';
      editBtn.style.display = '';
      saveFollowedTeams();
      displayFollowedTeams();
    });
  }
}