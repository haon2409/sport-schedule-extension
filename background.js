const API_KEY = 'GjZzmsBmadIp2qYgdmvMjCr0M3MbPX1qN97Te_qOnuAoMaZcr-E';
const API_URL = 'https://api.pandascore.co';

chrome.alarms.create('checkMatches', { periodInMinutes: 20 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkMatches') {
    await checkMatches();
  }
});

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

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    let nearestMatchTime = null;

    for (const team of followedTeams) {
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const liveData = await liveResponse.json();
      if (liveData.length > 0) {
        nearestMatchTime = new Date(liveData[0].begin_at || Date.now());
        break;
      }

      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&range[begin_at]=${startOfDay},${endOfDay}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      const upcomingData = await upcomingResponse.json();
      if (upcomingData.length > 0) {
        const matchTime = new Date(upcomingData[0].scheduled_at);
        if (!nearestMatchTime || matchTime < nearestMatchTime) {
          nearestMatchTime = matchTime;
        }
      }
    }

    updateBadge(nearestMatchTime);
  } catch (error) {
    console.error('Error checking matches:', error);
    resetBadge();
  }
}

function updateBadge(matchTime) {
  if (!matchTime) {
    resetBadge();
    return;
  }

  const date = new Date(matchTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  let badgeText = '';
  let backgroundColor = '';

  if (hours >= 0 && hours <= 12) {
    backgroundColor = '#00FF00'; // Xanh
    if (hours < 10) {
      badgeText = `${hours}:${minutes === 0 ? '00' : '30'}`; // 1:00 -> "1:00", 1:30 -> "1:30"
    } else {
      badgeText = minutes === 0 ? `${hours}` : `${hours}${minutes}`; // 11:00 -> "11", 11:30 -> "1130"
    }
  } else {
    backgroundColor = '#FF0000'; // Đỏ
    const displayHours = hours - 12; // 15h -> 3, 23h -> 11
    if (displayHours < 10) {
      badgeText = `${displayHours}:${minutes === 0 ? '00' : '30'}`; // 15:00 -> "3:00", 15:30 -> "3:30"
    } else {
      badgeText = minutes === 0 ? `${displayHours}` : `${displayHours}${minutes}`; // 23:00 -> "11", 23:30 -> "1130"
    }
  }

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}

function resetBadge() {
  chrome.action.setBadgeText({ text: '' });
}