export const API_URL = 'https://api.pandascore.co';
export const CACHE_DURATION = 60 * 60 * 1000; // 1 giờ

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
    throw new Error('NO_API_KEY');
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
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
          },
          mode: 'cors'
        });

        if (response.status === 401 || response.status === 403) {
          throw new Error('INVALID_API_KEY');
        }
        if (response.status === 429) {
          throw new Error('RATE_LIMIT');
        }
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        chrome.storage.local.set({ [cacheKey]: { data, timestamp: now } }, () => {
          updateClearCacheButtonState();
        });
        resolve(data);
      } catch (error) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          reject(new Error('NETWORK_ERROR'));
        } else {
          reject(error);
        }
      }
    });
  });
}

/** Map mã lỗi → message tiếng Việt */
export function getErrorMessage(error) {
  const code = error?.message || String(error) || '';
  switch (code) {
    case 'NO_API_KEY':
      return 'Chưa cấu hình API Key. Vào Options để cài đặt.';
    case 'INVALID_API_KEY':
      return 'API Key không hợp lệ hoặc đã hết hạn.';
    case 'RATE_LIMIT':
      return 'Đã vượt giới hạn request. Thử lại sau vài phút.';
    case 'NETWORK_ERROR':
      return 'Mất kết nối mạng. Kiểm tra internet và thử lại.';
    default:
      if (code.startsWith('HTTP_')) {
        return `Lỗi server (${code.replace('HTTP_', '')}). Thử lại sau.`;
      }
      return `Lỗi: ${code || 'Không xác định'}`;
  }
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