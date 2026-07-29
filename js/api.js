export const API_URL = 'https://api.pandascore.co';
export const CACHE_DURATION = 60 * 60 * 1000;

export async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['pandascoreApiKey'], (result) => {
      resolve(result.pandascoreApiKey || '');
    });
  });
}

export async function cachedFetch(url) {
  const API_KEY = await getApiKey();
  if (!API_KEY) {
    throw new Error('Chưa cấu hình API Key. Vui lòng bấm chuột phải vào icon tiện ích -> Options để cài đặt.');
  }

  return new Promise((resolve, reject) => {
    const cacheKey = 'api_cache_' + url;
    const now = Date.now();

    chrome.storage.local.get([cacheKey], async (result) => {
      const cached = result[cacheKey];
      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        resolve(cached.data);
        return;
      }

      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
          mode: 'cors'
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        chrome.storage.local.set({ [cacheKey]: { data, timestamp: now } }, () => {
          updateClearCacheButtonState();
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function updateClearCacheButtonState() {
  const btn = document.getElementById('clearCacheBtn');
  if (!btn) return;

  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    const hasValidCache = Object.keys(items).some(key => {
      if (key.startsWith('api_cache_')) {
        const cached = items[key];
        return cached && (now - cached.timestamp < CACHE_DURATION);
      }
      return false;
    });

    if (hasValidCache) {
      btn.removeAttribute('disabled');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.setAttribute('disabled', 'true');
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
  });
}

export async function clearAllCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(key => key.startsWith('api_cache_'));
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          updateClearCacheButtonState();
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}
