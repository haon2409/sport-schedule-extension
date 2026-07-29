const API_URL = 'https://api.pandascore.co';

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['pandascoreApiKey'], (result) => {
      resolve(result.pandascoreApiKey || '');
    });
  });
}

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
    const API_KEY = await getApiKey();
    if (!API_KEY) {
      resetBadge();
      return;
    }

    const { followedTeams } = await chrome.storage.local.get('followedTeams');
    if (!followedTeams || followedTeams.length === 0) {
      resetBadge();
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    let nearestMatchTime = null;

    for (const team of followedTeams) {
      // Live
      const liveResponse = await fetch(
        `${API_URL}/lol/matches/running?filter[opponent_id]=${team.id}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        if (liveData.length > 0) {
          nearestMatchTime = new Date(liveData[0].begin_at || Date.now());
          break;
        }
      }

      // Upcoming hôm nay
      const upcomingResponse = await fetch(
        `${API_URL}/lol/matches/upcoming?filter[opponent_id]=${team.id}&range[begin_at]=${startOfDay},${endOfDay}`,
        { headers: { 'Authorization': `Bearer ${API_KEY}` } }
      );
      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json();
        if (upcomingData.length > 0) {
          const matchTime = new Date(upcomingData[0].scheduled_at || upcomingData[0].begin_at);
          if (!nearestMatchTime || matchTime < nearestMatchTime) {
            nearestMatchTime = matchTime;
          }
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
  const minutes = date.getMinutes().toString().padStart(2, '0');
  let badgeText = '';
  let backgroundColor = '';

  if (hours >= 0 && hours < 12) {
    backgroundColor = '#00AA00';
    badgeText = hours < 10 ? `${hours}:${minutes}` : `${hours}${minutes}`;
  } else {
    backgroundColor = '#DD0000';
    const displayHours = hours === 12 ? 12 : hours - 12;
    badgeText = displayHours < 10 ? `${displayHours}:${minutes}` : `${displayHours}${minutes}`;
  }

  // Giới hạn badge text (Chrome max ~4 ký tự đẹp)
  if (badgeText.length > 4) {
    badgeText = `${hours}:${minutes}`.slice(0, 4);
  }

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
}

function resetBadge() {
  chrome.action.setBadgeText({ text: '' });
}