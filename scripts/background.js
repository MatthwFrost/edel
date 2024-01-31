// Runs when the user installs the extension.
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    // This code runs when the extension is first installed
    chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError) {
        console.error(JSON.stringify(chrome.runtime.lastError, null, 2));
        return;
      }
      
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const userInfo = await response.json();
      // console.log('User info fetched:', userInfo);
      const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setUpUser?user=${userInfo.id}`;
      const res = await fetch(url);
      const data = await res.json();

      try {
        await chrome.storage.local.set({'user': data.userID});
      } catch (error){
        console.error(error);
      }
          // Use the profile image URL as needed
    });
    // Place your initialization or setup script here
  } else if (details.reason === "update") {
    // This code runs when the extension is updated
  }
});

chrome.contextMenus.onClicked.addListener(clicked);

// This gets set 3 times. Bug in Chrome api? changeInfo is returning undefined.
chrome.tabs.onActivated.addListener(
  async function(changeInfo){
    // console.log("New tab", changeInfo.tabId);
    if(changeInfo.tabId){
      // console.log(changeInfo);
      createDefualtContextMenu();
      // chrome.tabs.executeScript(changeInfo.tabId, { file: "content.js" });
    } else if (changeInfo.url) {
      console.log(changeInfo.url);
      const redditCommentsRegex = /^https:\/\/www\.reddit\.com\/r\/[^\/]+\/comments\/[^\/]+\/[^\/]+/; // Thanks GPT
      if (redditCommentsRegex.test(changeInfo.url)) {
          await chrome.tabs.sendMessage(tabPlay.id, { reddit: true });
          console.log("Reddit site detected...")
      }
  }
  
});


async function clicked(info){
  try {
    switch(info.menuItemId){
      case "readContextMenu":
        getCharacters().then(async ({ characters, MAX }) => {
          const char = parseInt(characters);
          const max = parseInt(MAX);
          if (char < max){
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            await chrome.tabs.sendMessage(tab.id, {greeting: "clicked"});
          }else{
            // alert("You are out of characters. Purchase more to continue.")
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            await chrome.tabs.sendMessage(tab.id, {greeting: "out"});
          }
        }).catch(error => {
          console.error('Error fetching characters:', error);
        });

        break;
      case "playing":
        const [tabPlay] = await chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.sendMessage(tabPlay.id, {greeting: "stop"});
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    // Handle the error as needed
    chrome.storage.local.set({'error': error});
  }
}

function initialize() {
  chrome.storage.local.get(['voiceID', 'qualityID'], function(items) {
    voice = items.voiceID || 'old-british-man';
    quality = items.qualityID || 'low';

    // console.log('Initialized voice and quality:', voice, quality);
  });
}

// Had 2 onMessage listeners and that broke things.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getVoiceAndQuality") {
    sendResponse({ voice: voice, quality: quality });
  }
  else if (message.action === true) {
    playingState();
  }else if (message.action === false) {
    createDefualtContextMenu();
  }else if (message.action === "redditScriptLoaded") {
      // console.log("Reddit script has loaded in tab", sender.tab.id);

      // Send a response back
      sendResponse({ message: "Acknowledged the loading of Reddit script" });
      const [tabPlay] = chrome.tabs.query({active: true, currentWindow: true});
      chrome.tabs.sendMessage(tabPlay.id, {reddit: true});
  }
});

function playingState() {
  // Change the icon when loading starts
  chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: "playing",
    title: "Stop speaking",
    contexts: ["all"]
  });
}

function createDefualtContextMenu(){
  // Remove all context menus, then set the default state
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "readContextMenu",
    title: "Read aloud",
    contexts: ["selection"]
  }); 
}

function getCharacters() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('user', async function(items) {
      try {
        // console.log(items.user);
        const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/getCharacters?user=${items.user}`;
        console.log(url);
        const response = await fetch(url);
        const data = await response.json();

        const characters = data.characters;
        const MAX = data.MAX_CHARACTERS;

        resolve({characters, MAX}); // Resolve the promise with the data
      } catch (error) {
        console.error('Error in getCharacters:', error);
        reject(error); // Reject the promise in case of an error
      }
    });
  });
}