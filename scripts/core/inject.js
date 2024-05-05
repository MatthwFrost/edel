import AudioPlayer from './audioPlayer.js'

function injectHTMLAndCSS() {
  const htmlUrl = chrome.runtime.getURL('scripts/style/injectedContent.html');
  const cssUrl = chrome.runtime.getURL('scripts/style/elementStyle.css');

  Promise.all([
    fetch(htmlUrl).then(response => {
      if (!response.ok) throw new Error('Failed to load HTML');
      return response.text();
    }),
    fetch(cssUrl).then(response => {
      if (!response.ok) throw new Error('Failed to load CSS');
      return response.text();
    })
  ])
    .then(([htmlData, cssData]) => {
      const rootHtml = document.documentElement;
      const shadowHost = document.createElement('readel-extension');
      shadowHost.id = 'readel-extension';
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = cssData;
      shadowRoot.appendChild(style);

      const div = document.createElement('div');
      div.innerHTML = htmlData;
      shadowRoot.appendChild(div);

      rootHtml.appendChild(shadowHost);

      setupReadelExtension(shadowRoot);
    })
    .catch(err => console.error('Failed to load resources:', err));
}

async function setupReadelExtension(shadowRoot) {
  // Add all event listeners and setup logic after HTML/CSS have been loaded
  // ----- Logic ------
  const elements = setElements(shadowRoot);
  const { volumeValue, playbackRate } = await getPlaybackAndVolume();
  console.log(volumeValue, playbackRate);

  // set saved values;
  elements.volumeRange.value = volumeValue;
  elements.playbackButton.textContent = playbackRate + "x";

  let player;
  let playing = false;
  let playedBefore = false;
  player = new AudioPlayer();
  elements.playButton.addEventListener('click', () => {
    playing = !playing;
    handleUIChange(playing)
    if (playing) {
      if (playedBefore) {
        player.resume();
        console.log("resuming...")
      } else {
        const sentences = fetchAllText();
        player.startPlaybackCycle(sentences);
        console.log("playing...");
        playedBefore = true;
      }
    } else {
      player.pause();
      console.log("pausing...");
    }
  });

  elements.backwardButton.addEventListener('click', () => {
    player.skipBackward();
  });

  elements.forwardButton.addEventListener('click', () => {
    player.skipForward();
  });

  elements.resetButton.addEventListener('click', () => {
    if (playing){
      handleUIChange(false);
    }
    playedBefore = false; // Want to move this into the class.
    playing = false;
    player.reset();
  })

  elements.volumeRange.addEventListener('input', function () {
    if (player) {
      player.setVolume(this.value);
    }
    chrome.storage.local.set({ 'volumeValue': this.value });
  })

  elements.playbackContainer.addEventListener('click', e => {
    // Check if the clicked element is a link
    console.log("Click detected within shadow DOM");
    const link = e.target.closest('.dropdown-menu-link');
    if (link) {
      e.preventDefault(); // Prevent the default link behavior
      const playbackRate = link.getAttribute('data-id');
      console.log('Selected playback rate:', playbackRate);
      if (player) {
        player.setPlaybackRate(parseFloat(playbackRate));
        console.log('player is going');
      };
      elements.playbackButton.textContent = playbackRate + "x";
      chrome.storage.local.set({ 'playbackRate': playbackRate });
    }
  });

  setupEventListeners(shadowRoot);

  /**
   * @param {Boolean} isPlaying
   * @description Handle any ui changes based on play state.
   */
  function handleUIChange(isPlaying) {
    elements.mainContainer.style.width = isPlaying ? "200px" : "150px";
    elements.settingsContainer.style.width = isPlaying ? "60%" : "75%";
    elements.playerContainer.style.width = isPlaying ? "40%" : "25%";
    elements.playButton.innerHTML = isPlaying 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

    setTimeout(() => {
      elements.forwardButton.hidden = !elements.forwardButton.hidden;
      elements.backwardButton.hidden = !elements.backwardButton.hidden;
      elements.resetButton.hidden = !elements.resetButton.hidden;
    }, isPlaying ? 500 : 0);
    chrome.runtime.sendMessage({ action: isPlaying });
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

      if (playing) {
        if (playedBefore) {
          player.resume();
          console.log("resuming...")
        } else {
          const text = window.getSelection().toString().trim(); // Get selected text
          const allPageText = getPageText();
          const sentences = fetchFromSelectedText(allPageText, text);
          player.startPlaybackCycle(sentences);
          console.log("playing...");
          playedBefore = true;
        }
      } else {
        player.pause();
        console.log("pausing...");
      }
    }
    else if (request.greeting === "stop") {
      playing = false;
      handleUIChange(false);
      player.pause();
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
  // ----- Logic ------
}

function setupEventListeners(shadowRoot) {
  shadowRoot.addEventListener('click', e => {
    const isDropdownButton = e.target.matches("[data-dropdown-button]");
    if (!isDropdownButton && e.target.closest('[data-dropdown]') != null) return;

    let currentDropdown;
    if (isDropdownButton) {
      currentDropdown = e.target.closest('[data-dropdown]');
      currentDropdown.classList.toggle('active');
    }

    shadowRoot.querySelectorAll("[data-dropdown].active").forEach(dropdown => {
      if (dropdown === currentDropdown) return;
      dropdown.classList.remove('active');
    });
  });
}

async function getPlaybackAndVolume() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["volumeValue", "playbackRate"], (items) => {
      const volumeValue = items.volumeValue || 0.5;
      const playbackRate = items.playbackRate || 1;
      resolve({ volumeValue, playbackRate });
    })
  });
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
  // Trim the combined text here
  return combinedText.trim();
}

function fetchAllText() {
  const res = getPageText();
  return splitIntoSentences(res);
}

function fetchFromSelectedText(text, selectedText) {
  // Use indexOf for a direct substring search
  const searchTerm = text.indexOf(selectedText);

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

function setElements(shadowRoot) {
  const elements = {
    audioContainer: shadowRoot.querySelector('#audio-container'),
    mainContainer: shadowRoot.querySelector('#main-container'),
    settingsContainer: shadowRoot.querySelector('#settings-container'),
    playerContainer: shadowRoot.querySelector('#player-container'),
    playerContainerChild: shadowRoot.querySelector('#player-container-child'),
    playButton: shadowRoot.querySelector('#player-button'),
    forwardButton: shadowRoot.querySelector('#fskip-button'),
    backwardButton: shadowRoot.querySelector('#bskip-button'),
    resetButton: shadowRoot.querySelector('#reset-button'),
    playbackContainer: shadowRoot.querySelector('#playback-rate-selector'),
    playbackButton: shadowRoot.querySelector('#playback-rate'),
    volumeRange: shadowRoot.getElementById('volume-range')
  }
  return elements;
}

// Call the function to inject HTML and CSS
injectHTMLAndCSS();
