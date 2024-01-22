chrome.contextMenus.onClicked.addListener(clicked);

// This gets set 3 times. Bug in Chrome api? changeInfo is returning undefined.
chrome.tabs.onActivated.addListener(
  function(changeInfo){
    if(changeInfo.tabId){
      // console.log(changeInfo);
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