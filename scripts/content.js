// Pause button doesn't pause context menu audio.

// Set global variables.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
let offset;
let arrayBuffer;
let playbackPosition = 0; // Track playback position
let volume;
let isButtonInejcted = false;
let playbackRate = 1;
let showPlayback;
let currentIndex = 0;
let sentences = [];
let audioBuffers = [];
let playing = false;
let source = null;


// --- New ---
let audioController;
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
  const DOM = document.body;
  const audioContainer = buildAudioContainer();
  const root = audioContainer.attachShadow({ mode: "open" });
  const audioPlayer = document.createElement("audio");

  audioController = buildAudioController();
  audioControllerButtonContainer = buildAudioControllerButtonContainer();
  audioControllerPlayButton = buildAudioControllerPlayButton();
  audioControllerSkipBackwardButton = buildAudioControllerSkipBackwardButton();
  audioControllerSkipForwardButton = buildAudioControllerSkipForwardButton();

  audioControllerButtonContainer.appendChild(audioControllerSkipBackwardButton);
  audioControllerButtonContainer.appendChild(audioControllerPlayButton);
  audioControllerButtonContainer.appendChild(audioControllerSkipForwardButton);
  audioController.appendChild(audioControllerButtonContainer);

  // Settings button; ---------------------------------------------
  toggleSettingsContainer = buildSettingsToggleContainer();
  settingsContainer = buildSettingsContainer();
  settingsVolumeButton = buildVolumeButton();
  settingsPlaybackControllButton = buildPlaybackButton();
  settingsVolumeSlider = buildSettingsVolumeSlider();
  settingsPlaybackControllSlider = buildSettingsPlaybackControllSlider();
 
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

  settingsPlaybackControllSlider.addEventListener("input", function () {
    playbackRate = this.value;
    source.playbackRate.value = this.value;
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
    SkipBackward();
  });
  audioControllerSkipForwardButton.addEventListener("click", function () {
    SkipForward();
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

  // skipButtonUI();
  // Append elements to container.
  root.appendChild(toggleSettingsContainer);
  root.appendChild(audioPlayer);
  root.appendChild(audioController);
  DOM.appendChild(audioContainer); // Append to DOM body.
}

function buildVolumeButton(){
  const settingsVolumeButton = document.createElement("button");
  settingsVolumeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 640 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"/></svg>`;
  settingsVolumeButton.style.backgroundColor = "transparent";
  settingsVolumeButton.style.zIndex = "999";
  settingsVolumeButton.style.display = "flex";
  settingsVolumeButton.style.alignItems = "center";
  settingsVolumeButton.style.border = "none";
  settingsVolumeButton.style.cursor = "pointer";
  return settingsVolumeButton;
}

function buildPlaybackButton(){
  const settingsPlaybackControllButton = document.createElement("button");
  settingsPlaybackControllButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm320 96c0-26.9-16.5-49.9-40-59.3V88c0-13.3-10.7-24-24-24s-24 10.7-24 24V292.7c-23.5 9.5-40 32.5-40 59.3c0 35.3 28.7 64 64 64s64-28.7 64-64zM144 176a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm-16 80a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM400 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>`;
  settingsPlaybackControllButton.style.backgroundColor = "transparent";
  settingsPlaybackControllButton.style.zIndex = "999";
  settingsPlaybackControllButton.style.marginLeft = "5px";
  settingsPlaybackControllButton.style.display = "flex";
  settingsPlaybackControllButton.style.alignItems = "center";
  settingsPlaybackControllButton.style.border = "none";
  settingsPlaybackControllButton.style.cursor = "pointer";
  return settingsPlaybackControllButton;
}

function buildSettingsContainer(){
  const settingsContainer = document.createElement("div");
  settingsContainer.style.display = "flex";
  settingsContainer.style.width = "0"; // Start with minimal width
  settingsContainer.style.overflow = "hidden"; // Prevent content overflow during animation
  settingsContainer.style.visibility = "hidden"; // Initially not visible but occupies space for smooth transition
  settingsContainer.style.transition = "width 0.4s ease, opacity 0.5s ease"; // Transition for width and opacity
  settingsContainer.style.height = "40px";
  settingsContainer.style.borderRadius = "30px 1px 1px 30px"; // Rounded edges
  settingsContainer.style.backgroundColor = "black";
  settingsContainer.style.flexDirection = "row";
  settingsContainer.style.alignItems = "center";
  settingsContainer.style.justifyContent = "center";
  return settingsContainer;
}

function buildSettingsToggleContainer(){
  const toggleSettingsContainer = document.createElement("div");
  toggleSettingsContainer.style.position = "fixed";
  toggleSettingsContainer.style.display = "flex"; // Ensure it's ready to layout its children
  toggleSettingsContainer.style.visibility = "visible"; // Make sure it's not hiding its children
  toggleSettingsContainer.style.bottom = `${screen.height / 2 - 20}px`;
  toggleSettingsContainer.style.right = "50px";
  toggleSettingsContainer.style.alignItems = "center";
  return toggleSettingsContainer;
}

function buildSettingsVolumeSlider(){
  const settingsVolumeSlider = document.createElement("input");
  settingsVolumeSlider.setAttribute("id", "volume-id");
  settingsVolumeSlider.style.position = "fixed";
  settingsVolumeSlider.style.display = "none";
  settingsVolumeSlider.style.bottom = `${screen.height / 2 + 25}px`;
  settingsVolumeSlider.style.right = "65px";
  settingsVolumeSlider.type = "range";
  settingsVolumeSlider.style.height = "0px";
  settingsVolumeSlider.style.transition = "width 0.2s ease, opacity 0.4s ease"; // Transition for width and opacity
  settingsVolumeSlider.style.opacity = "0"; // Transition for width and opacity
  settingsVolumeSlider.style.writingMode = "vertical-lr";
  settingsVolumeSlider.min = 0;
  settingsVolumeSlider.max = 100;
  settingsVolumeSlider.step = "0.25";
  settingsVolumeSlider.value = "50";
  settingsVolumeSlider.style.webkitAppearance = "none";
  settingsVolumeSlider.style.width = "20px";
  settingsVolumeSlider.style.height = "100px";
  settingsVolumeSlider.style.borderRadius = "5px";
  settingsVolumeSlider.style.background = "#d3d3d3";
  settingsVolumeSlider.style.outline = "none";
  settingsVolumeSlider.style.transition = "opacity .2s";
  return settingsVolumeSlider;
}

function buildSettingsPlaybackControllSlider(){
  const settingsPlaybackControllSlider = document.createElement("input");
  settingsPlaybackControllSlider.setAttribute("id", "volume-id");
  settingsPlaybackControllSlider.style.position = "fixed";
  settingsPlaybackControllSlider.style.display = "none";
  settingsPlaybackControllSlider.style.bottom = `${screen.height / 2 + 25}px`;
  settingsPlaybackControllSlider.style.right = "93px";
  settingsPlaybackControllSlider.type = "range";
  settingsPlaybackControllSlider.style.height = "100px";
  settingsPlaybackControllSlider.style.writingMode = "vertical-lr";
  settingsPlaybackControllSlider.min = 0.25;
  settingsPlaybackControllSlider.max = 1;
  settingsPlaybackControllSlider.step = "0.25";
  settingsPlaybackControllSlider.value = "1";
  settingsPlaybackControllSlider.style.webkitAppearance = "none";
  settingsPlaybackControllSlider.style.width = "20px";
  settingsPlaybackControllSlider.style.height = "100px";
  settingsPlaybackControllSlider.style.borderRadius = "5px";
  settingsPlaybackControllSlider.style.background = "#d3d3d3";
  settingsPlaybackControllSlider.style.outline = "none";
  settingsPlaybackControllSlider.style.transition = "opacity .2s";
  return settingsPlaybackControllSlider;
}

function buildAudioController(){
  const audioController = document.createElement("div");
  audioController.style.width = "45px";
  audioController.style.height = "40px";
  audioController.style.backgroundColor = "#084b83";
  audioController.style.opacity = "0.6";
  audioController.style.borderRadius = "30px 0px 0px 30px"; // Rounded edges
  audioController.style.boxShadow = "0 4px 30px rgba(0, 0, 0, 0.1)";
  audioController.style.backdropFilter = "blur(9.8px)";
  audioController.style.webkitBackdropFilter = "blur(9.8px)";
  audioController.style.transition = "width 0.5s ease, opacity 0.5s ease"; // Smooth transition for width
  audioController.style.border = "1px black";
  audioController.style.overflowX = "hidden";
  audioController.style.whiteSpace = "nowrap";
  audioController.style.display = "inline-block";
  audioController.style.fontSize = "20px";
  audioController.style.cursor = "pointer";
  return audioController;
}

function buildAudioControllerButtonContainer(){
  const audioControllerButtonContainer = document.createElement("div");
  audioControllerButtonContainer.style.width = "100%";
  audioControllerButtonContainer.style.height = "100%";
  audioControllerButtonContainer.style.display = "flex";
  audioControllerButtonContainer.style.alignItems = "center";
  audioControllerButtonContainer.style.justifyContent = "center";
  return audioControllerButtonContainer;
}

function buildAudioControllerPlayButton(){
  const audioControllerPlayButton = document.createElement("button");
  audioControllerPlayButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" height="16" width="16" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`;
  audioControllerPlayButton.style.display = "flex";
  audioControllerPlayButton.style.alignItems = "center";
  audioControllerPlayButton.style.justifyContent = "center";
  audioControllerPlayButton.style.background = "none";
  audioControllerPlayButton.style.backgroundColor = "none";
  audioControllerPlayButton.style.border = "none";
  audioControllerPlayButton.style.cursor = "pointer";
  return audioControllerPlayButton;
}

function buildAudioControllerSkipBackwardButton(){
  const audioControllerSkipBackwardButton = document.createElement("button");
  audioControllerSkipBackwardButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-back"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>`;
  audioControllerSkipBackwardButton.style.visibility = "hidden";
  audioControllerSkipBackwardButton.style.display = "flex";
  audioControllerSkipBackwardButton.style.alignItems = "center";
  audioControllerSkipBackwardButton.style.justifyContent = "center";
  audioControllerSkipBackwardButton.style.background = "none";
  audioControllerSkipBackwardButton.style.backgroundColor = "none";
  audioControllerSkipBackwardButton.style.border = "none";
  audioControllerSkipBackwardButton.style.cursor = "pointer";
  return audioControllerSkipBackwardButton;
}

function buildAudioControllerSkipForwardButton(){ 
  const audioControllerSkipForwardButton = document.createElement("button");
  audioControllerSkipForwardButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
  audioControllerSkipForwardButton.style.display = "flex";
  audioControllerSkipForwardButton.style.visibility = "hidden";
  audioControllerSkipForwardButton.style.alignItems = "center";
  audioControllerSkipForwardButton.style.justifyContent = "center";
  audioControllerSkipForwardButton.style.background = "none";
  audioControllerSkipForwardButton.style.backgroundColor = "none";
  audioControllerSkipForwardButton.style.border = "none";
  audioControllerSkipForwardButton.style.cursor = "pointer";
  return audioControllerSkipForwardButton;
}

function buildAudioContainer(){
  const audioContainer = document.createElement("div");
  audioContainer.style.position = "fixed";
  audioContainer.style.bottom = screen.height / 2 + "px";
  audioContainer.style.right = "0px";
  audioContainer.style.height = "20px";
  audioContainer.style.zIndex = "10000";
  audioContainer.className = "readel-audio-player";
  return audioContainer;
}

// ----------------------------------------------------------------------------------

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
  } else if (request.greeting === "stop") {
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

// Initialize the process with an array of sentences
async function initializeAudioPlayback(sentences) {
  const user = await getUser();
  if (user) {
    audioBuffers = []; // Stores prefetched audio buffers
    currentIndex = 0; // Tracks the current audio buffer to be played
    if (sentences.length === 0) return;

    // Prefetch the first sentence and start playback
    console.log(sentences);
    setCursorToWait(true);
    audioBuffers[0] = await QueueAudio(sentences[0]);
    setCursorToWait(false);
    handleAudioPlay(sentences);
    // setLastPlayDate();
  } else {
    alert("Please sign in to use Readel.");
  }
}

// Plays the current audio buffer and prefetches the next sentence
// Revised playAudio function to handle buffer playback and manage source
async function playAudio(buffer) {
  if (playing) {
    if (!buffer) return;

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    if (source) {
      source.disconnect();
    }

    source = audioCtx.createBufferSource();
    try {
      source.buffer = buffer;
    } catch {}

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (playbackRate) {
      source.playbackRate.value = playbackRate;
    }
    source.start(0);
    playing = true;

    source.onended = async () => {
      currentIndex++;
      if (currentIndex < sentences.length) {
        console.log("Playing next sentence");
        await handleAudioPlay(); // Proceed to next without passing sentences again
      } else {
        console.log("Playback finished");
        handleUIChange(false);
        playing = false;
        currentIndex = 0; // Reset for next playthrough
      }
    };
  } else {
    PauseAudio();
  }
}

// Fetches TTS and queues up the next sentence for playback
async function handleAudioPlay() {
  if (currentIndex >= sentences.length) {
    console.log("No more sentences to play.");
    return;
  }

  if (!playing) {
    console.log("Playback has been paused or stopped.");
    return;
  }

  // Checking credits before playing each sentence
  // const response = await chrome.runtime.sendMessage({action: 'getCredits', amount: sentences[currentIndex].length});
  // if (response.message === 'OUTOFCREDITS') {
  //     alert("Sorry, Readel has ran out of credits.");
  //     handleUIChange(false);
  //     playing = false;
  //     return;
  // } else if (response.message === 'ok') {
  if (!audioBuffers[currentIndex]) {
    audioBuffers[currentIndex] = await QueueAudio(sentences[currentIndex]);
  }
  await playAudio(audioBuffers[currentIndex]);

  // Prefetch the next sentence if it exists
  if (currentIndex + 1 < sentences.length && !audioBuffers[currentIndex + 1]) {
    // await setCharacter(sentences[currentIndex].length);
    audioBuffers[currentIndex + 1] = await QueueAudio(
      sentences[currentIndex + 1]
    );
  }
  // } else {
  //     alert("There has been an error playing the audio.");
  // }
}

function PauseAudio() {
  if (!source) return;
  handleUIChange(false);
  source.stop();
  playing = false;
  playbackPosition = audioCtx.currentTime - source.startTime; // Update playback position based on current time and start time
}

function SkipForward() {
  if (source) {
    source.stop();
    audioBuffers[currentIndex];
    playAudio(audioBuffers);
  }
}

function SkipBackward() {
  if (source) {
    source.stop();
  }
  audioBuffers[currentIndex--];
  playAudio(audioBuffers);
}

async function QueueAudio(text) {
  let audioData = await fetchTTS(text, currentIndex);
  return new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(
      audioData,
      (buffer) => {
        resolve(buffer); // Resolve after setting buffer
      },
      (error) => {
        console.error("Error decoding audio data:", error);
        reject(error);
      }
    );
  });
}

async function fetchTTS(sentence, currentSentenceIndex) {
  try {
    const { voice, quality } = await fetchVoiceAndQualitySettings();
    let url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${sentence}&index=${currentSentenceIndex}&voice=${voice}&quality=${quality}`;
    const res = await fetch(url);
    const data = await res.json();

    return base64ToArrayBuffer(data.audioBase64);
  } catch (error) {
    console.error("Error in fetchTTS:", error);
    throw error; // Re-throw the error for further handling if necessary
  }
}

// FYI, fetches once per instance. Doesn't check every sentence. Not sure if I want to change
// too allow for speed changes for longer form content.
function fetchVoiceAndQualitySettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["voiceID", "qualityID"], function (items) {
      const voice = items.voiceID || "robert";
      const quality = items.qualityID || "low";
      resolve({ voice, quality });
    });
  });
}

// Turns the returned base64 from API, and turn into Audio ready array buffer.
function base64ToArrayBuffer(base64) {
  var binaryString = atob(base64);
  var bytes = new Uint8Array(binaryString.length);
  for (var i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * @param {Boolean} isPlaying
 * @param {Boolean} isLoading
 * @description Handle any UI changes based on play state.
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

function skipButtonUI() {
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
