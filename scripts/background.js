chrome.contextMenus.onClicked.addListener(clicked);

async function clicked(){
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  const response = await chrome.tabs.sendMessage(tab.id, {greeting: "clicked"});
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: "readContextMenu",
    title: "Listen to selected text ( Takes a second )",
    contexts: ["selection"]
  });
});
