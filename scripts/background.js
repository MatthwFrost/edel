const path = "scripts/content.js";
let tabID;

// Runs when the user installs the extension.
chrome.runtime.onInstalled.addListener(async function(details) {
  if (details.reason === "install") {
    // Place your initialization or setup script here
    signInHelper();
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
        files: [path]
      })
      tabID = changeInfo.id
      await chrome.storage.sync.set({tabID: true});
      createDefualtContextMenu();
    }
});

// inject when tab is refreshed.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Check if the URL matches specific criteria
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: [path]
    })
  }
});

async function getTabUrl(){
  return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          var currentTab = tabs[0];
          if (currentTab) {
              // Get the URL of the current tab
              resolve(currentTab.url);
          }
      });
  })
}

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
            await chrome.tabs.sendMessage(tab.id, {greeting: "out"});
          }
        }).catch(async (error) => {
          // You could refresh the page and then read from local storage to continue reading.
          // chrome.tabs.reload(tab.tabId);
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
  } else if (message.action === "getCredits"){
    getCharacters().then(async ({ characters, MAX }) => {

      const char = parseInt(characters);
      const max = parseInt(MAX);
      console.log(message.amount);
      if (message.amount){
        const characterCountOnceFinished = char + message.amount;
        console.log(characterCountOnceFinished);
        if (characterCountOnceFinished <= max){
          sendResponse({ message: "ok" })
        }
      }

      if (char <= max){
        sendResponse({ message: "ok"});
      }else if (char >= max){
        // alert("You are out of characters. Purchase more to continue.")
        console.log(char);
        sendResponse({ message: "OUTOFCREDITS" });
      }
    }).catch(async (error) => {
      // You could refresh the page and then read from local storage to continue reading.
      // chrome.tabs.reload(tab.tabId);
      await chrome.tabs.sendmessage(tab.id, {error: "userInfoError"});
      console.error(error);
    });
  }else if (message.action === "authUserPopup"){
    signInHelper();
  }else if (message.action === "getTabUrl"){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var currentTab = tabs[0];
        if (currentTab) {
            // Get the URL of the current tab
            sendResponse(currentTab.url);
        }
    });
  }
  return true;
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
        const [tabPlay] = chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.sendmessage(tabID, {error: "userInfoError"});
        reject(error); // Reject the promise in case of an error
      }
    });
    
  });
}

async function getUser(){
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get('accessToken', async function(items) {
      if (chrome.runtime.lastError) {
        console.error("Error obtaining token:", JSON.stringify(chrome.runtime.lastError, null, 2));
        return;
      }
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${items.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching user info: ${response.status}`);
        }

        let userInfo = await response.json();
        resolve({userInfo});
      } catch (error) {
        const [tabPlay] = chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.sendmessage(tabID, {error: "userInfoError"});
        console.error("Error in extension setup:", error.message);
        reject(error)
      }
    });
  })
}

function signInHelper(){
  // This code runs when the extension is first installed
  const REDIRECT_URL = chrome.identity.getRedirectURL();
  // console.log(REDIRECT_URL);
  // const REDIRECT_URL = "https://www.google.com";
  const clientID =
  "227012789435-ih22fn4rv6eos09jfp1p0b3h5l2rtt96.apps.googleusercontent.com";
  const scopes = ["openid", "email", "profile"];
  // console.log(REDIRECT_URL);
  let authURL = "https://accounts.google.com/o/oauth2/auth";
  authURL += `?client_id=${clientID}`;
  authURL += `&response_type=token`;
  authURL += `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`;
  authURL += `&scope=${encodeURIComponent(scopes.join(" "))}`;
  authURL += `&prompt=select_account`;
  chrome.identity.launchWebAuthFlow(
    {
      url: authURL,
      interactive: true,
    },
    async function(redirectUrl) {
      // console.log('Redirect URL:', redirectUrl);
      // Extract the token from the redirect URL.
      if (redirectUrl) {
        const url = new URL(redirectUrl);
        const hashParams = new URLSearchParams(url.hash.substring(1)); // Remove the '#' at the start.
        const accessToken = hashParams.get('access_token');
        await chrome.storage.sync.set({'accessToken': accessToken});
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Error fetching user info: ${response.status}`);
        }

        const userInfo = await response.json();
        try {
          await chrome.storage.sync.set({'user': userInfo.id});
          await chrome.storage.sync.set({'email': userInfo.email});
          console.log("added user to local")
        } catch (error) {
          console.error("Error adding to storage", error);
        }

        const urlAWS = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setUpUser?user=${userInfo.id}&email=${userInfo.email}`;
        const setUpResponse = await fetch(urlAWS);

        if (!setUpResponse.ok) {
          throw new Error(`Error in setUpUser request: ${setUpResponse.status}`);
        }

      } else {
        console.error('OAuth2 login failed or was cancelled.');
      }
    }
  );
}