const API_KEY = 'GjZzmsBmadIp2qYgdmvMjCr0M3MbPX1qN97Te_qOnuAoMaZcr-E';
const API_URL = 'https://api.pandascore.co';

// Tạo alarm chạy mỗi 20 phút
chrome.alarms.create('checkMatches', { periodInMinutes: 20 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMatches') {
    await checkMatches();
  }
});

// Chạy ngay khi extension được cài hoặc cập nhật
chrome.runtime.onInstalled.addListener(() => {
  checkMatches();
});

async function checkMatches() {
  try {
    const { followedTeams } = await chrome.storage.local.get('followedTeams');
    if (!followedTeams || followedTeams.length === 0) {
      resetBadge();
      return;
    }

    let totalMatches = 0;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    for (const team of followedTeams) {
      // Kiểm tra trận đấu đang diễn ra
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      totalMatches += liveData.length;

      // Kiểm tra trận đấu sắp tới trong ngày
      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&range[begin_at]=${startOfDay},${endOfDay}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      totalMatches += upcomingData.length;
    }

    updateBadge(totalMatches);
  } catch (error) {
    console.error('Error checking matches:', error);
    resetBadge();
  }
}

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Nền đỏ
    chrome.action.setBadgeTextColor({ color: '#FFFFFF' });       // Chữ trắng
  } else {
    resetBadge();
  }
}

function resetBadge() {
  chrome.action.setBadgeText({ text: '' });
}