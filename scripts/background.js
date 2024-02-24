
// Runs when the user installs the extension.
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === "install") {
    // This code runs when the extension is first installed
    chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError) {
        console.error("Error obtaining token:", JSON.stringify(chrome.runtime.lastError, null, 2));
        return;
      }
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching user info: ${response.status}`);
        }

        const userInfo = await response.json();
        // console.log('User info fetched:', userInfo);

        // It's important that this succeeds.
        try {
          console.log("added user to local")
          await chrome.storage.sync.set({'user': userInfo.id});
        } catch (error) {
          console.error("Error adding to storage", error);
        }

        const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setUpUser?user=${userInfo.id}&email=${userInfo.email}`;
        const setUpResponse = await fetch(url);

        if (!setUpResponse.ok) {
          throw new Error(`Error in setUpUser request: ${setUpResponse.status}`);
        }

      } catch (error) {
        console.error("Error in extension setup:", error.message);
      }
    });
    // Place your initialization or setup script here
  } else if (details.reason === "update") {
    // This code runs when the extension is updated
    // chrome.storage.local.set({reloadTabsOnActivate: true});
  }
});

// Listen for a context menu click.
chrome.contextMenus.onClicked.addListener(clicked);

chrome.tabs.onActivated.addListener(
  async function(changeInfo){
    console.log(changeInfo);
    // console.log("New tab", changeInfo.tabId);
    if(changeInfo.tabId){
      chrome.scripting.executeScript({
        target: {tabId: changeInfo.tabId},
        files: ["scripts/content.js"]
      })

      console.log(changeInfo);
      createDefualtContextMenu();
    }
});

// inject when tab is refreshed.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Check if the URL matches specific criteria
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ["scripts/content.js"]
    })
  }
});

let connectionError = "Error: Could not establish connection. Receiving end does not exist."
async function clicked(info){
  try {
    // Inject script.
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    console.log("Clicked");

    switch(info.menuItemId){
      case "readContextMenu":
        getCharacters().then(async ({ characters, MAX }) => {
          const char = parseInt(characters);
          const max = parseInt(MAX);
          if (char <= max){
            await chrome.tabs.sendMessage(tab.id, {greeting: "clicked"});
          }else if (char >= max){
            // alert("You are out of characters. Purchase more to continue.")
            console.log(char);
            await chrome.tabs.sendmessage(tab.id, {greeting: "out"});
          } else {
            
          }
        }).catch(async (error) => {
          // You could refresh the page and then read from local storage to continue reading.
          chrome.tabs.reload(tab.tabId);
          // await chrome.tabs.sendmessage(tab.id, {error: "connection-error"});
          console.error(error);
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
    voice = items.voiceID || 'robert';
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
  return new Promise(async (resolve, reject) => {
    await chrome.storage.sync.get('user', async function(items) {
      try {
        console.log(items.user);
        let userID = items.user;
        if (!userID){
          // If fails, we should call google user api. 
          //
          // Ew so much slower. This is a back up.
          // console.log("fetch failed; Getting manually");
          let user = await getUser();
          userID = user.userInfo.id
        }
        // console.log(items.user);
        const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/getCharacters?user=${userID}`;
        // console.log(url);
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

async function getUser(){
  return new Promise((resolve, reject) => {
  chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError) {
        console.error("Error obtaining token:", JSON.stringify(chrome.runtime.lastError, null, 2));
        return;
      }
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching user info: ${response.status}`);
        }

        let userInfo = await response.json();
        resolve({userInfo});
      } catch (error) {
        console.error("Error in extension setup:", error.message);
        reject(error)
      }
    });
  })
}
