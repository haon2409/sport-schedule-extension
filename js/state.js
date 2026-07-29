export let followedTeams = [];
export let followedTournaments = [];
export let selectedTeamId = null;
export let selectedTournamentId = null;
export let originalFollowedTeams = [];
export let isEditingTeams = false;
export let originalFollowedTournaments = [];
export let isEditingTournaments = false;

export function setFollowedTeams(teams) {
  followedTeams = teams;
}

export function setFollowedTournaments(tournaments) {
  followedTournaments = tournaments;
}

export function setSelectedTeamId(id) {
  selectedTeamId = id;
}

export function setSelectedTournamentId(id) {
  selectedTournamentId = id;
}

export function setIsEditingTeams(value) {
  isEditingTeams = value;
}

export function setIsEditingTournaments(value) {
  isEditingTournaments = value;
}

export function setOriginalFollowedTeams(teams) {
  originalFollowedTeams = teams;
}

export function setOriginalFollowedTournaments(tournaments) {
  originalFollowedTournaments = tournaments;
}
