import UI from './style.js'
// import { Player, context} from 'tone';
import * as Tone from 'tone';

let isButtonInejcted = false;
let playbackRate = 1;
let showPlayback;
let currentIndex = 0;
let sentences = [];
let playing = false;
let source = null;

// --- New ---
let audioController;
let audioContainer;
let audioControllerButtonContainer;
let audioControllerPlayButton;
let audioControllerSkipBackwardButton;
let audioControllerSkipForwardButton;
let toggleSettingsContainer;
let settingsContainer;
let settingsVolumeButton;
let settingsPlaybackControllButton;
let settingsVolumeSlider;
let settingsPlaybackControllSlider;
let showVolume;
let isPlaying = false;
let bufferIndex;
let bufferQueue = [];
let audioCtx;
let gainNode;
let fetchInProgress = false;
const player = new Tone.Player().toDestination();

const tags = ["h1", "p", "li"]; // Define the tags you're interested in
let combinedText = ""; // String to hold the combined text content

tags.forEach((tag) => {
  const elements = document.querySelectorAll(tag); // Get all elements for the current tag
  elements.forEach((element) => {
    combinedText += element.innerText + " "; // Concatenate the text content with a space
  });
});

// Inject audio player.
// ----------------------------------------------------------------------------------
function injectAudioPlayer() {
  const ui = new UI()
  const DOM = document.body;
  audioContainer = ui.buildAudioContainer();
  const root = audioContainer.attachShadow({ mode: "open" });
  const audioPlayer = document.createElement("audio");

  audioController = ui.buildAudioController();
  audioControllerButtonContainer = ui.buildAudioControllerButtonContainer();
  audioControllerPlayButton = ui.buildAudioControllerPlayButton();
  audioControllerSkipBackwardButton = ui.buildAudioControllerSkipBackwardButton();
  audioControllerSkipForwardButton = ui.buildAudioControllerSkipForwardButton();
  // --- Added to page ---
  audioControllerButtonContainer.appendChild(audioControllerSkipBackwardButton);
  audioControllerButtonContainer.appendChild(audioControllerPlayButton);
  audioControllerButtonContainer.appendChild(audioControllerSkipForwardButton);
  audioController.appendChild(audioControllerButtonContainer);

  // Settings button; ---------------------------------------------
  toggleSettingsContainer = ui.buildSettingsToggleContainer();
  settingsContainer = ui.buildSettingsContainer();
  settingsVolumeButton = ui.buildVolumeButton();
  settingsPlaybackControllButton = ui.buildPlaybackButton();
  settingsVolumeSlider = ui.buildSettingsVolumeSlider();
  settingsPlaybackControllSlider = ui.buildSettingsPlaybackControllSlider();

  DOM.appendChild(settingsPlaybackControllSlider);
  DOM.appendChild(settingsVolumeSlider);

  // Function to create a style element for the thumb
  function addThumbStyle(styleId, css) {
    var head = document.head || document.getElementsByTagName("head")[0],
      style = document.createElement("style");
    head.appendChild(style);
    style.type = "text/css";
    style.id = styleId;
    if (style.styleSheet) {
      // This is required for IE8 and below.
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  // Add styles for the volumeControl thumb for WebKit browsers
  addThumbStyle(
    "volumeControl-thumb-webkit",
    `
    .volumeControl::-webkit-volumeControl-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 45px;
        height: 5px;
        background: #04AA6D;
        cursor: pointer;
    }
    `
  );

  // Add styles for the volumeControl thumb for Firefox
  addThumbStyle(
    "volumeControl-thumb-moz",
    `
    .volumeControl::-moz-range-thumb {
        width: 25px;
        height: 45px;
        background: #04AA6D;
        cursor: pointer;
    }
    `
  );

  settingsVolumeSlider.addEventListener(
    "input",
    function () {
      gainNode.gain.setValueAtTime(this.value / 100, audioCtx.currentTime);
    },
    false
  );

  const settingsPlaybackRateSlider = ui.buildSettingsPlaybackControllSlider();
  settingsPlaybackRateSlider.addEventListener("input", function () {
    playbackRate = parseFloat(this.value);
    source.playbackRate.value = this.value;
    console.log(playbackRate);
  });

  // settingsContainer.appendChild(playbackControllButton);
  settingsContainer.appendChild(settingsVolumeButton);

  toggleSettingsContainer.appendChild(settingsContainer);

  showVolume = false;
  settingsVolumeButton.addEventListener("click", function () {
    showVolume = !showVolume;
    if (showVolume) {
      settingsVolumeSlider.style.display = "block";
      settingsVolumeSlider.style.opacity = "1"; // Transition for width and opacity
      settingsVolumeSlider.style.height = "100px";
    } else {
      settingsVolumeSlider.style.display = "none";
      settingsVolumeSlider.style.opacity = "0"; // Transition for width and opacity
      settingsVolumeSlider.style.height = "0px";
    }
  });

  showPlayback = false;
  settingsPlaybackControllButton.addEventListener("click", function () {
    showPlayback = !showPlayback;
    if (showPlayback) {
      settingsPlaybackControllSlider.style.display = "block";
    } else {
      settingsPlaybackControllSlider.style.display = "none";
    }
  });

  let hoverTimer;
  function showSettings() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      audioController.style.opacity = "1";
      settingsContainer.style.visibility = "visible";
      settingsContainer.style.opacity = "1";
      settingsContainer.style.width = "50px";
      audioController.style.borderRadius = "5px 0px 0px 5px";
    }, 600);
  }

  function hideSettings() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      settingsContainer.style.width = "0";
      settingsContainer.style.opacity = "0";
      settingsVolumeSlider.style.display = "none";
      settingsPlaybackControllSlider.style.display = "none";
      audioController.style.opacity = "0.7";
      audioController.style.borderRadius = "30px 0px 0px 30px"; // Rounded edges
      // Wait for the opacity transition to finish before hiding the element
      setTimeout(() => {
        settingsContainer.style.visibility = "hidden";
      }, 500); // The timeout should match the transition duration of opacity
    }, 1000);
  }

  audioController.addEventListener("mouseenter", showSettings);
  audioController.addEventListener("mouseleave", hideSettings);
  toggleSettingsContainer.addEventListener("mouseenter", showSettings);
  toggleSettingsContainer.addEventListener("mouseleave", hideSettings);
  settingsVolumeSlider.addEventListener("mouseenter", showSettings);
  settingsVolumeSlider.addEventListener("mouseleave", hideSettings);
  settingsPlaybackControllSlider.addEventListener("mouseenter", showSettings);
  settingsPlaybackControllSlider.addEventListener("mouseleave", hideSettings);

  audioControllerSkipBackwardButton.addEventListener("click", function () {
    SkipBackward(sentences);
  });
  audioControllerSkipForwardButton.addEventListener("click", function () {
    SkipForward(sentences);
  });

  // Click handler.
  audioControllerPlayButton.addEventListener("click", function () {
    playing = !playing;
    // console.log("audio is playing: ", playing);

    if (playing) {
      handleUIChange(true);
      sentences = getPageText();
      initializeAudioPlayback(sentences);
    } else {
      // If audio playing is true. pause audio.
      handleUIChange(false);
      PauseAudio();
    }
  });

  // skipButtonui();
  // Append elements to container.


  root.appendChild(settingsPlaybackRateSlider);
  root.appendChild(toggleSettingsContainer);
  root.appendChild(audioPlayer);
  root.appendChild(audioController);
  DOM.appendChild(audioContainer); // Append to DOM body.
}
/**
  @params request includes what type of message is sent.
  @return Initiats the correct function for the backend request.
**/
chrome.runtime.onMessage.addListener(function (request) {
  if (request.greeting === "clicked") {
    // Starts the audio fetching process.
    playing = true;
    handleUIChange(true);
    const text = window.getSelection().toString().trim(); // Get selected text
    sentences = fetchFromSelectedText(combinedText, text);
    initializeAudioPlayback(sentences);
  }
  else if (request.greeting === "stop") {
    playing = false;
    handleUIChange(false);
    PauseAudio();
  } else if (request.greeting === "out") {
    alert("Readel has ran out of characters");
  } else if (request.install === "error") {
    alert(
      "There has been an error with you install. Please contact our support."
    );
  } else if (request.error === "userInfoError") {
    alert("Please sign in to use Readel.");
  }
});

// Assuming other parts of content.js remain unchanged

// Improved Preloading and Buffer Management
async function initializeAudioPlayback(sentences) {
  const user = await getUser();
  if (!user) {
    alert("Please sign in to use Readel.");
    return;
  }

  if (sentences.length === 0) {
    console.log("No sentences provided.");
    return;
  }

  setCursorToWait(true);
  isPlaying = true;
  currentIndex = 0;
  await Tone.start();
  await preloadBuffers(sentences, currentIndex, 3); // Preload the first few sentences
  setCursorToWait(false);
  handleAudioPlay(sentences);
}

async function preloadBuffers(sentences, index, count) {
  for (let i = index; i < Math.min(index + count, sentences.length); i++) {
    if (!bufferQueue[i]) {
      console.log("Preloading audio for sentence at index:", i);
      try {
        bufferQueue[i] = await queueAudio(sentences, i);
      } catch (error) {
        console.error("Failed to preload buffer:", error);
      }
    }
  }
}

async function handleAudioPlay(sentences) {
  if (currentIndex >= sentences.length) {
    console.log("No more sentences to play.");
    return;
  }

  if (bufferQueue[currentIndex]) {
    console.log("Audio ready and being played.");
    playAudioStream(bufferQueue[currentIndex], sentences);
    // Start preloading the next clip immediately
    if (currentIndex + 1 < sentences.length) {
      preloadBuffers(sentences, currentIndex + 1, 3);
    }
  } else {
    console.log("Waiting for buffer to become available...");
    setTimeout(() => handleAudioPlay(sentences), 500); // Retry after a delay
  }
}


async function queueAudio(sentences, currentIndex) {
  console.log("Starting fetch for index:", currentIndex);
  try {
    const audioBase64 = await fetchTTS(sentences[currentIndex], currentIndex);
    const audioData = base64ToArrayBuffer(audioBase64);
    return await Tone.context.decodeAudioData(audioData);
  } catch (e) {
    console.error("Error fetching or decoding audio data:", e);
    throw e;
  }
}

function playAudioStream(buffer, sentences) {
  if (isPlaying){
    console.log("Buffer passed to function: ", buffer);
    player.buffer = buffer;
    player.start();

    player.onstop = async () => {
      currentIndex++;
      if (!isPlaying){
        if (currentIndex < sentences.length) {
          console.log("Playing next sentence");
          await handleAudioPlay(sentences);
        } else {
          console.log("Playback finished");
          handleUIChange(false);
          isPlaying = false;
          currentIndex = 0; // Reset for next playthrough
        }
      }
    };
  }else {
    PauseAudio();
  }
}

function SkipForward(sentences) {
  player.stop();  // Ensure to stop the current playing audio
  currentIndex++;
  handleAudioPlay(sentences); 
}

function SkipBackward(sentences) {
  if (fetchInProgress || currentIndex === 0) {
      console.log("Fetch in progress or already at the first sentence.");
      return;
  }
  fetchInProgress = true;  // Set the flag to indicate fetching is in progress
  player.stop();  // Ensure to stop the current playing audio
  currentIndex--;
  handleAudioPlay(sentences).finally(() => {
      fetchInProgress = false;  // Reset the flag once done
  });
}

function PauseAudio() {
  player.stop();
  isPlaying = false;
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
  var binaryString = window.atob(base64);
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchTTS(sentence, currentSentenceIndex) {
  try {
    const { voice, quality } = await fetchVoiceAndQualitySettings();
    let url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${encodeURIComponent(sentence)}&index=${currentSentenceIndex}&voice=${voice}&quality=${quality}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.audioBase64;
  } catch (error) {
    console.error("Error in fetchTTS:", error);
    throw error;
  }
}

function fetchVoiceAndQualitySettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["voiceID", "qualityID"], (items) => {
      const voice = items.voiceID || "defaultVoice";
      const quality = items.qualityID || "standardQuality";
      resolve({ voice, quality });
    });
  });
}

/**
 * @param {Boolean} isPlaying
 * @param {Boolean} isLoading
 * @description Handle any ui changes based on play state.
 */
function handleUIChange(isPlaying) {
  if (isButtonInejcted) {
    audioControllerButtonContainer.innerHTML = "";
    const label = document.createElement("span");
    audioControllerButtonContainer.style.display = "flex";
    audioControllerButtonContainer.style.alignItems = "center";
    audioControllerButtonContainer.style.justifyContent = "center";
    // const icon = document.createElement('div');
    if (isPlaying) {
      audioController.style.width = "100px";
      settingsContainer.style.opacity = "1";
      audioControllerPlayButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" height="18" width="8.75" viewBox="0 0 320 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>`;
      audioControllerSkipBackwardButton.style.visibility = "visible";
      audioControllerSkipForwardButton.style.visibility = "visible";
      settingsVolumeSlider.style.right = "120px";
      settingsPlaybackControllSlider.style.right = "148px";
      toggleSettingsContainer.style.right = "105px";
      audioControllerPlayButton.appendChild(label);
      audioControllerButtonContainer.appendChild(audioControllerSkipBackwardButton);
      audioControllerButtonContainer.appendChild(audioControllerPlayButton);
      audioControllerButtonContainer.appendChild(audioControllerSkipForwardButton);

      chrome.runtime.sendMessage({ action: true });
    } else if (!isPlaying) {
      audioController.style.width = "45px";
      settingsContainer.style.opacity = "0.7";
      audioControllerPlayButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" height="18" width="10.5" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`;
      toggleSettingsContainer.style.right = "50px";
      settingsVolumeSlider.style.right = "55px";
      settingsPlaybackControllSlider.style.right = "85px";
      audioControllerPlayButton.appendChild(label);
      audioControllerButtonContainer.appendChild(audioControllerPlayButton);

      chrome.runtime.sendMessage({ action: false });
    }
  } else {
    if (isPlaying) {
      chrome.runtime.sendMessage({ action: true });
    } else if (!isPlaying) {
      chrome.runtime.sendMessage({ action: false });
    }
  }
}

function setCursorToWait(isLoading) {
  if (isLoading) {
    const style = document.createElement("style");
    style.id = "corsor_wait";
    style.innerHTML = "* {cursor: wait;}";
    document.head.insertBefore(style, null);
  } else {
    document.getElementById("corsor_wait").remove();
  }
}

/**
  Takes the length of the string.
  @param the length of the string being read aloud.
  @return GET to AWS lambda setCharacter function.
**/
async function setCharacter(length) {
  chrome.storage.sync.get("user", function (result) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (result.user === undefined) {
      return;
    }

    const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setCharacters?user=${result.user}&updateChar=${length}`;
    fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${result}`,
      },
    })
      .then((response) => response.json())
      .catch((error) => {
        console.error("Error fetching user info:", error);
      });
  });
  return;
}

function fetchFromSelectedText(text, selectedText) {
  // Use indexOf for a direct substring search
  const searchTerm = text.indexOf(selectedText);

  // console.log("\nSelected Text:", selectedText);
  // console.log("\nFull Text:", text);
  // console.log("Search Term Index:", searchTerm);

  // Check if the selectedText is found
  if (searchTerm === -1) {
    console.log("Selected text not found in the main body of the text.");
    return splitIntoSentences(selectedText);
  }

  // Return the substring from the found index to the end
  return splitIntoSentences(text.slice(searchTerm));
}

function splitIntoSentences(text) {
  let sentences = text.match(/[^.;:\n!?]+[.;:\n!?]+/g) || [];
  sentences = sentences.map((sentence) => sentence.trim()); // Trim each sentence
  return sentences;
}

function getPageText() {
  const article = document.querySelector("article");
  let combinedText = "";

  if (article) {
    combinedText = article.innerText;
  } else {
    const tags = ["h1", "p", "li"];
    tags.forEach((tag) => {
      const elements = document.querySelectorAll(tag);
      elements.forEach((element) => {
        combinedText += element.innerText + " ";
      });
    });
  }
  combinedText = combinedText.trim(); // Trim the combined text here
  return splitIntoSentences(combinedText);
}

async function getUser() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("user", async function (items) {
      if (items.user === undefined) {
        alert(
          "Oh no, you are not signed in! Click on 'Readel' in the Extensions tab to sign in."
        );
        resolve({ return: false });
      }
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        resolve({ return: false });
      }
    });
    resolve({ return: true });
  });
}

async function getTabUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "getTabUrl" },
      async function (response) {
        // console.log(response);
        resolve(response);
      }
    );
  });
}

async function injectButton() {
  const sentences = getPageText();
  let totalCharacters = await sentences.reduce(
    (acc, sentence) => acc + sentence.length,
    0
  );
  const url = await getTabUrl();
  if (
    totalCharacters >= 800 &&
    !(url.includes("www.youtube.com") || url.includes("chat.openai.com"))
  ) {
    isButtonInejcted = true;
    injectAudioPlayer();
  }
}

function skipButtonui() {
  const skipFoward = document.createElement("button");
  skipFoward.textContent = "->";
  skipFoward.style.position = "fixed";
  // audioContainer.style.backgroundColor = "yellow";
  skipFoward.style.bottom = "150px";
  skipFoward.style.right = "40px";
  skipFoward.style.height = "20px";
  skipFoward.style.zIndex = "10000";

  document.body.appendChild(skipFoward);

  skipFoward.addEventListener("click", function () {
    currentIndex += 1;
    handleAudioPlay();
  });
}

// Load script onto page.
injectButton();
