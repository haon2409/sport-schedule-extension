import { followedTeams, followedTournaments } from './state.js';

export function saveFollowedTeams() {
  chrome.storage.local.set({ followedTeams });
}

export function saveFollowedTournaments() {
  chrome.storage.local.set({ followedTournaments });
}
