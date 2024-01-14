chrome.contextMenus.onClicked.addListener(clicked);

async function clicked(info){

  switch(info.menuItemId){
    case "readContextMenu":
      const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
      const response = await chrome.tabs.sendMessage(tab.id, {greeting: "clicked"});
      // console.log("Clicked detected", info.menuItemId);
      break;
    case "playing":
      const [tabPlay] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
      const res = await chrome.tabs.sendMessage(tabPlay.id, {greeting: "stop"});
      // console.log("Clicked detected", info.menuItemId);
      break;
    default:
      break;
  }

}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: "readContextMenu",
    title: "Listen to selected text ( Takes a second )",
    contexts: ["selection"]
  });
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === true) {
      playingState();
    }else if (request.action === false) {
      stopState();
    }
  }
);

// Assume you have some code where loading starts
function playingState() {
  // Change the icon when loading starts
  chrome.contextMenus.removeAll()

  chrome.contextMenus.create({
    id: "playing",
    title: "Stop speaking",
    contexts: ["all"]
  });
  // Perform your loading tasks here
}

// Assume you have some code where loading finishes
function stopState() {
  chrome.contextMenus.removeAll()

  chrome.contextMenus.create({
    id: "readContextMenu",
    title: "Listen to selected text ( Takes a second )",
    contexts: ["selection"]
  });
}