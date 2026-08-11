import { updateClearCacheButtonState, clearAllCache } from './api.js';
import {
  setFollowedTeams, setFollowedTournaments, setSelectedTeamId
} from './state.js';
import {
  checkMatchesOnPopupOpen, displayFollowedTeams, searchTeam, setupTeamEditButtons
} from './ui-teams.js';
import {
  checkTournamentMatchesOnPopupOpen, displayFollowedTournaments, searchTournament, setupTournamentEditButtons
} from './ui-tournaments.js';
import { displayTeamSchedule } from './schedule.js';
import { icons } from './icons.js';

// Hàm tiện ích khởi tạo HTML trạng thái
function setContainerState(elementId, htmlContent) {
  const container = document.getElementById(elementId);
  if (container) {
    container.innerHTML = htmlContent;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const followedTeamsDiv = document.getElementById('followedTeams');
  
  // 1. Chỉ để loading ở danh sách đội/giải đang tải dữ liệu
  setContainerState('followedTeams', '<div class="loading">Đang tải danh sách đội...</div>');
  setContainerState('followedTournaments', '<div class="loading">Đang tải danh sách giải...</div>');

  // 2. Mặc định các ô chi tiết hiển thị trạng thái chưa chọn (KHÔNG ĐỂ LOADING)
  setContainerState('scheduleList', '<div class="no-data">Chưa chọn đội tuyển</div>');
  setContainerState('tournamentScheduleList', '<div class="no-data">Chưa chọn giải đấu</div>');
  setContainerState('tournamentStandingsList', '<div class="no-data">Chưa chọn giải đấu</div>');

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
      setContainerState('followedTeams', '<div class="no-data">Chưa theo dõi đội nào</div>');
    }
    
    if (result.followedTournaments) {
      setFollowedTournaments(result.followedTournaments);
      await checkTournamentMatchesOnPopupOpen();
      displayFollowedTournaments();
    } else {
      setContainerState('followedTournaments', '<div class="no-data">Chưa theo dõi giải đấu nào</div>');
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

  const handleScheduleClick = (e) => {
    const teamElement = e.target.closest('[data-team-id], [data-id], [data-opponent-id]');
    
    if (teamElement) {
      const rawId = teamElement.dataset.teamId || teamElement.dataset.id || teamElement.dataset.opponentId;
      
      if (rawId && rawId !== 'undefined') {
        e.stopPropagation();
        const teamId = parseInt(rawId, 10);
        
        setSelectedTeamId(teamId);
        displayFollowedTeams();
        displayTeamSchedule(teamId);
      }
    }
  };

  const followedTournamentsDiv = document.getElementById('followedTournaments');
  if (followedTournamentsDiv) {
    followedTournamentsDiv.addEventListener('click', handleScheduleClick);
  }

  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  if (tournamentScheduleList) {
    tournamentScheduleList.addEventListener('click', handleScheduleClick);
  }

  const scheduleList = document.getElementById('scheduleList');
  if (scheduleList) {
    scheduleList.innerHTML = '<div class="no-data">Chưa chọn đội tuyển</div>';
    scheduleList.addEventListener('click', handleScheduleClick);
  }

  document.addEventListener('click', (e) => {
    const tournamentItem = e.target.closest('.tournament-item');
    if (!tournamentItem) return;

    const teamBlock = e.target.closest('.followed-team-block, .followed-opponent-block');
    
    if (teamBlock && !teamBlock.classList.contains('followed-opponent-block--empty')) {
      const rawId = teamBlock.dataset.teamId || teamBlock.dataset.id || teamBlock.dataset.opponentId;
      
      if (rawId) {
        e.stopPropagation(); 
        const teamId = parseInt(rawId, 10);
        
        const teamsTabBtn = document.querySelector('.tab-button[data-tab="teams"]');
        if (teamsTabBtn) teamsTabBtn.click();
        
        setSelectedTeamId(teamId);
        displayFollowedTeams();
        displayTeamSchedule(teamId);
      }
    }

    const tournamentStandingsList = document.getElementById('tournamentStandingsList');
    if (tournamentStandingsList) {
      tournamentStandingsList.addEventListener('click', handleScheduleClick);
    }
  }, true);
});