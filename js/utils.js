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
