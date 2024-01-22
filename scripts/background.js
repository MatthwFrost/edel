chrome.contextMenus.onClicked.addListener(clicked);

// This gets set 3 times. Bug in Chrome api? changeInfo is returning undefined.
chrome.tabs.onActivated.addListener(
  function(changeInfo){
    if(changeInfo.status === undefined){
      createDefualtContextMenu();
  }
});

// chrome.runtime.onInstalled.addListener(
//   function () {
//     createDefualtContextMenu();
// });

async function clicked(info){
  switch(info.menuItemId){
    case "readContextMenu":
      const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
      await chrome.tabs.sendMessage(tab.id, {greeting: "clicked"});
      break;
    case "playing":
      const [tabPlay] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
      await chrome.tabs.sendMessage(tabPlay.id, {greeting: "stop"});
      break;
    default:
      break;
  }
}


chrome.runtime.onMessage.addListener(
  function(request) {
    if (request.action === true) {
      playingState();
    }else if (request.action === false) {
      createDefualtContextMenu();
    }
  }
);

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
    title: "Listen to selected text ( Takes a second )",
    contexts: ["selection"]
  }); 
}


// function getSassy(){
//   // Add some sass into the program
//   // Reads from a file and then returns a random a piece of audio.

//   // Need to secure this key.
//   let EL_API_KEY = '1a2411f0a67edc064394ae22239f7aa9';

//   const voices = {
//     old_british_man: "fjUEyxiEBGhIdIzLmVus",
//     lily: "pFZP5JQG7iQjIQuC4Bku",
//     myOwnVoice: "iCFUKc3rB6sfwKZLdamJ",
//   }

//   let STREAMINGLATENCY= 3
//   let METHOD = 'stream'

//   const options = {
//     method: 'POST',
//     headers: {
//       'xi-api-key': EL_API_KEY, 
//       'Content-Type': 'application/json'
//     },
//     body: `{"text":"I can't be bothered. I don't get paid enough...", "model_id":"eleven_turbo_v2", "stability":50}`
//   };

//   fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices.old_british_man}/${METHOD}?optimize_streaming_latency=${STREAMINGLATENCY}`, options)
//     .then(response => response.arrayBuffer())
//     .then(data => { 
//       // Play audio with the saved array buffer.
//       const key = 'sassAudio';
//       const value = { name: data };
//       chrome.storage.local.set({key: value}, () => {
//         console.log('Stored name: ' + value.name);
//       });
//     })
// }
