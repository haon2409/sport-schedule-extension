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

  const handleScheduleClick = (e) => {
    const teamElement = e.target.closest('[data-team-id], [data-id], [data-opponent-id]');
    
    if (teamElement) {
      const rawId = teamElement.dataset.teamId || teamElement.dataset.id || teamElement.dataset.opponentId;
      
      if (rawId && rawId !== 'undefined') {
        e.stopPropagation(); // Chặn lan truyền sự kiện
        const teamId = parseInt(rawId, 10);
        
        setSelectedTeamId(teamId);
        displayFollowedTeams();
        displayTeamSchedule(teamId);
      }
    }
  };

  // 1. Gắn cho danh sách giải đang theo dõi
  const followedTournamentsDiv = document.getElementById('followedTournaments');
  if (followedTournamentsDiv) {
    followedTournamentsDiv.addEventListener('click', handleScheduleClick);
  }

  // 2. Gắn lại cho lịch thi đấu giải (Đảm bảo khu vực này hoạt động trở lại)
  const tournamentScheduleList = document.getElementById('tournamentScheduleList');
  if (tournamentScheduleList) {
    tournamentScheduleList.addEventListener('click', handleScheduleClick);
  }

  // 3. Gắn cho lịch thi đấu thông thường (nếu có)
  const scheduleList = document.getElementById('scheduleList');
  if (scheduleList) {
    scheduleList.addEventListener('click', handleScheduleClick);
  }

  // Lắng nghe click toàn cục ở giai đoạn Capture (thêm "true" ở cuối) để ưu tiên xử lý click đội tuyển trước
  document.addEventListener('click', (e) => {
    // 1. Kiểm tra xem có đang click bên trong một dòng của danh sách Giải đấu không
    const tournamentItem = e.target.closest('.tournament-item');
    if (!tournamentItem) return;

    // 2. Kiểm tra mục tiêu click có phải là khu vực tên/logo đội tuyển không
    const teamBlock = e.target.closest('.followed-team-block, .followed-opponent-block');
    
    if (teamBlock && !teamBlock.classList.contains('followed-opponent-block--empty')) {
      const rawId = teamBlock.dataset.teamId || teamBlock.dataset.id || teamBlock.dataset.opponentId;
      
      if (rawId) {
        // 3. CHẶN sự kiện lan truyền xuống dòng giải đấu (ngăn mở lịch giải)
        e.stopPropagation(); 
        
        const teamId = parseInt(rawId, 10);
        
        // 4. (Tuỳ chọn) Tự động chuyển sang tab Đội tuyển nếu UI đang dùng tab ẩn/hiện
        const teamsTabBtn = document.querySelector('.tab-button[data-tab="teams"]');
        if (teamsTabBtn) teamsTabBtn.click();
        
        // 5. Hiển thị lịch thi đấu đội tuyển
        setSelectedTeamId(teamId);
        displayFollowedTeams();
        displayTeamSchedule(teamId);
      }
    }
  }, true); // <-- Quan trọng: 'true' giúp bắt sự kiện chặn đứng trước khi nó chạy code của ui-tournaments.js
});