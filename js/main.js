import { updateClearCacheButtonState, clearAllCache } from './api.js';
import {
  setFollowedTeams, setFollowedTournaments
} from './state.js';
import {
  checkMatchesOnPopupOpen, displayFollowedTeams, searchTeam, setupTeamEditButtons
} from './ui-teams.js';
import {
  checkTournamentMatchesOnPopupOpen, displayFollowedTournaments, searchTournament, setupTournamentEditButtons
} from './ui-tournaments.js';
import { icons } from './icons.js';

document.addEventListener('DOMContentLoaded', async () => {
  const followedTeamsDiv = document.getElementById('followedTeams');
  followedTeamsDiv.innerHTML = '<div class="loading">Đang tải danh sách đội...</div>';

  // Header actions: Settings + Clear cache
  const headerActions = document.getElementById('headerActions');
  if (headerActions && !document.getElementById('clearCacheBtn')) {
    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.id = 'settingsBtn';
    settingsBtn.className = 'btn btn-icon';
    settingsBtn.title = 'Cài đặt API Key';
    settingsBtn.innerHTML = icons.settings;
    settingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });

    const clearCacheBtn = document.createElement('button');
    clearCacheBtn.type = 'button';
    clearCacheBtn.id = 'clearCacheBtn';
    clearCacheBtn.className = 'btn btn-icon';
    clearCacheBtn.title = 'Xóa cache';
    clearCacheBtn.innerHTML = icons.trash;
    clearCacheBtn.addEventListener('click', async () => {
      await clearAllCache();
    });

    headerActions.appendChild(settingsBtn);
    headerActions.appendChild(clearCacheBtn);

    setupTeamEditButtons();
    setupTournamentEditButtons();
  }

  updateClearCacheButtonState();

  chrome.storage.local.get(['followedTeams', 'followedTournaments'], async (result) => {
    if (result.followedTeams) {
      setFollowedTeams(result.followedTeams);
      await checkMatchesOnPopupOpen();
      displayFollowedTeams();
    } else {
      followedTeamsDiv.innerHTML = '';
    }
    if (result.followedTournaments) {
      setFollowedTournaments(result.followedTournaments);
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
