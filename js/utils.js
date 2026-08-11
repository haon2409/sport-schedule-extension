export function isToday(dateString) {
  if (!dateString) return false;
  const matchDate = new Date(dateString);
  const today = new Date();
  return matchDate.getDate() === today.getDate() &&
    matchDate.getMonth() === today.getMonth() &&
    matchDate.getFullYear() === today.getFullYear();
}

export function getMatchTournamentName(match) {
  const leagueName = match?.league?.name;
  if (!leagueName) return null;

  const abbreviations = {
    'Esports World Cup': 'EWC',
  };
  return abbreviations[leagueName] || leagueName;
}

export function handleImageError(img) {
  // Kiểm tra nếu đã thử tải ảnh fallback hoặc link hiện tại đã là placeholder
  if (img.dataset.fallbackApplied || img.src.includes('via.placeholder.com')) {
    // Sử dụng ảnh SVG dạng base64 (chạy offline, không bao giờ lỗi mạng) để ngắt hoàn toàn vòng lặp
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="%23cccccc"/></svg>';
    return;
  }
  
  // Đánh dấu đã chạy fallback
  img.dataset.fallbackApplied = 'true';
  img.src = 'https://via.placeholder.com/24';
}

export function formatDateTime(dateString) {
  if (!dateString) return 'Chưa xác định';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Thời gian không hợp lệ';

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const weekday = weekdays[date.getDay()];
  return `${hours}:${minutes}, ${weekday}, ${day}/${month}`;
}

/** Hiển thị lỗi thân thiện vào container */
export function showError(container, error) {
  if (!container) return;
  const msg = typeof error === 'string'
    ? error
    : (error?.message || 'Lỗi không xác định');
  container.innerHTML = `<div class="error">${msg}</div>`;
}