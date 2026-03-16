// DogEar - Background Service Worker
// Handles extension lifecycle events and coordinates between content scripts.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('DogEar installed.');
  } else if (details.reason === 'update') {
    console.log(`DogEar updated to version ${chrome.runtime.getManifest().version}.`);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // TODO: handle messages from content script
  return false;
});
