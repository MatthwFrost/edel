// Pause button doesn't pause context menu audio.

// Set global variables.
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioCtx.createGain();
gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
let offset;
let audioController;
let cont;
let volumeControl;
let arrayBuffer;
let playbackPosition = 0; // Track playback position
let buttonDiv;
let volume;
let isButtonInejcted = false;

let currentIndex = 0; // Tracks the current audio buffer to be played
let sentences = []; // Global sentences array
let audioBuffers = []; // Stores prefetched audio buffers
let playing = false; // Tracks whether audio is currently playing
let source = null; // Currently playing audio source


const tags = ['h1', 'p', 'li']; // Define the tags you're interested in
let combinedText = ''; // String to hold the combined text content

tags.forEach(tag => {
    const elements = document.querySelectorAll(tag); // Get all elements for the current tag
    elements.forEach(element => {
        combinedText += element.innerText + " "; // Concatenate the text content with a space
    });
});

// Inject audio player.
// ----------------------------------------------------------------------------------
function AudioPlayerButton(){
    const DOM = document.body;
    let show = false;

    // Create audio container.
    const audioContainer = document.createElement('div');
    const root = audioContainer.attachShadow({mode: 'open'});
    audioContainer.style.position = 'fixed';
    // audioContainer.style.backgroundColor = "yellow";
    audioContainer.style.bottom = '100px';
    audioContainer.style.right = '40px';
    audioContainer.style.height = '20px';
    audioContainer.style.zIndex = '10000';

    // Create audio player.
    const audioPlayer = document.createElement('audio');

    // Create pause and play button.
    audioController = document.createElement('button');
    audioContainer.className = "readel-audio-player";
    audioController.style.width = '100px';
    audioController.style.height = '30px';
    audioController.style.backgroundColor = 'rgba(255, 248, 18, 0.5)';
    audioController.style.borderRadius = '30px 5px 30px 30px'; // Rounded edges
    audioController.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)'
    audioController.style.backdropFilter = 'blur(9.8px)';
    audioController.style.webkitBackdropFilter = 'blur(9.8px)'
    audioController.style.border = '2px solid rgba(255, 248, 18, 1)';
    audioController.style.transition = 'width 0.5s ease'; // Smooth transition for width
    audioController.style.overflowX = 'hidden';
    audioController.style.whiteSpace= 'nowrap';
    audioController.style.display = 'inline-block';
    audioController.style.marginLeft = '20px';
    audioController.style.fontSize = '20px';
    audioController.style.cursor = 'pointer';

    // background: rgba(255, 248, 18, 0.7);
    // border-radius: 16px;
    // box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    // backdrop-filter: blur(5.1px);
    // -webkit-backdrop-filter: blur(5.1px);
    // border: 1px solid rgba(255, 248, 18, 1);
    


    buttonDiv = document.createElement('div');
    buttonDiv.style.display = 'flex';
    buttonDiv.style.alignItems = 'center';
    buttonDiv.style.justifyContent = 'center';

    const icon = document.createElement('div');
    icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#000000" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    `
    const label = document.createElement('span');
    label.textContent = "Readel";
    label.style.fontSize = '16px';
    label.style.marginLeft = '5px';
    label.style.marginRight = '5px';
    icon.appendChild(label);
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontSize = '16px';
    buttonDiv.appendChild(icon);
    audioController.appendChild(buttonDiv);

    // Settings button; ---------------------------------------------
    cont = document.createElement('div');
    cont.style.position = 'fixed';
    cont.style.display = 'flex'; // Ensure it's ready to layout its children
    cont.style.visibility = 'visible'; // Make sure it's not hiding its children
    cont.style.bottom = '90px';
    cont.style.right = '145px';
    cont.style.alignItems = 'center';

    const settingsContainer = document.createElement('div');
    settingsContainer.style.display = 'flex';
    settingsContainer.style.width = '0'; // Start with minimal width
    settingsContainer.style.overflow = 'hidden'; // Prevent content overflow during animation
    settingsContainer.style.visibility = 'hidden'; // Initially not visible but occupies space for smooth transition
    settingsContainer.style.transition = 'width 0.2s ease, opacity 0.5s ease'; // Transition for width and opacity
    settingsContainer.style.height = '30px';
    settingsContainer.style.borderRadius = '30px 1px 1px 30px'; // Rounded edges
    // settingsContainer.style.paddingTop = '2px'; // Rounded edges
    settingsContainer.style.backgroundColor = 'black';
    settingsContainer.style.flexDirection = 'row';
    settingsContainer.style.alignItems = 'center';
    settingsContainer.style.justifyContent = 'center';

    const exit = document.createElement('button');
    exit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="18px" width="18px" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>`
    exit.style.backgroundColor = 'transparent';
    exit.style.display = 'flex';
    exit.style.alignItems = 'center';
    exit.style.border = 'none';

    const settingsButtonContainer = document.createElement('button');
    settingsButtonContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 640 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"/></svg>`
    settingsButtonContainer.style.backgroundColor = 'transparent';
    settingsButtonContainer.style.zIndex = '999';
    settingsButtonContainer.style.display = 'flex';
    settingsButtonContainer.style.alignItems = 'center';
    settingsButtonContainer.style.border = 'none';

    volumeControl = document.createElement('input');
    volumeControl.setAttribute('id', 'volume-id');
    volumeControl.style.position = 'fixed';
    volumeControl.style.display = 'none';
    volumeControl.style.bottom = '120px';
    volumeControl.style.right = '75px';
    volumeControl.type = 'range';
    volumeControl.style.height = '100px';
    volumeControl.style.paddingBottom = '10px';
    volumeControl.orient = 'vertical';
    volumeControl.min = 0;
    volumeControl.max = 100;
    volumeControl.style.appearance = 'slider-vertical';
    DOM.appendChild(volumeControl);

    volumeControl.addEventListener('input', function() {
        gainNode.gain.setValueAtTime(this.value / 100, audioCtx.currentTime);
      }, false);

    settingsContainer.appendChild(exit);
    settingsContainer.appendChild(settingsButtonContainer);

    cont.appendChild(settingsContainer);


    showVolume = false;
    settingsButtonContainer.addEventListener('click', function(){
        if (showVolume){
            volumeControl.style.display = 'block';
        }else {
            volumeControl.style.display = 'none';
        }
        showVolume = !showVolume;
    })


    let hoverTimer;
    audioController.addEventListener('mouseenter', function() {
        audioController.style.backgroundColor = 'rgba(255, 248, 18, 1)';
        // Start the timer when mouse enters the button
        hoverTimer = setTimeout(function() {
            // Show the action button if hovered over for 2 seconds
            settingsContainer.style.visibility = 'visible';
            settingsContainer.style.opacity = '1';
            settingsContainer.style.width = '60px'; // Example final width
            audioController.style.borderRadius = '1px 1px 15px 1px'; // Rounded edges
        }, 600);
    });
    audioController.addEventListener('mouseleave', function() {
        audioController.style.backgroundColor = 'rgba(255, 248, 18, 0.7)';
        clearTimeout(hoverTimer);
    });

    exit.addEventListener('click', function(){
        // Animate the width reduction and opacity decrease
        settingsContainer.style.width = '0';
        settingsContainer.style.opacity = '0';
        volumeControl.style.display = 'none';

        // Wait for the opacity transition to finish before hiding the element
        setTimeout(() => {
            settingsContainer.style.visibility = 'hidden';
        }, 500); // The timeout should match the transition duration of opacity
        audioController.style.borderRadius = '30px 5px 30px 30px'; // Rounded edges
    })


    // Click handler.
    audioController.addEventListener('click', function(){
        playing = !playing;
        console.log("audio is playing: ", playing);

        if (playing){
            handleUIChange(true);
            sentences = getPageText();
            initializeAudioPlayback(sentences);
        } else {
            // If audio playing is true. pause audio.
            handleUIChange(false);
            PauseAudio();
        }
    })

    // skipButtonUI();
    // Append elements to container.
    root.appendChild(cont);
    root.appendChild(audioPlayer);
    root.appendChild(audioController);
    DOM.appendChild(audioContainer);        // Append to DOM body.
}
// ----------------------------------------------------------------------------------

/**
  @params request includes what type of message is sent.
  @return Initiats the correct function for the backend request.
**/
chrome.runtime.onMessage.addListener(function(request) {
    if (request.greeting === "clicked") {                   // Starts the audio fetching process.
        playing = true;
        handleUIChange(true);
        const text = window.getSelection().toString().trim(); // Get selected text
        sentences = fetchFromSelectedText(combinedText, text);
        initializeAudioPlayback(sentences);
    } else if (request.greeting === "stop") {
        playing = false;
        handleUIChange(false);
        PauseAudio();
    } else if (request.greeting === "out"){
        alert("Readel has ran out of characters");
    } else if (request.install === "error"){
        alert("There has been an error with you install. Please contact our support.")
    } else if (request.error === "userInfoError"){
        alert("Please sign in to use Readel.");
    }
  });

// Initialize the process with an array of sentences
async function initializeAudioPlayback(sentences) {
    const user = await getUser();
    if (user){
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
    }else{
        alert("Please sign in to use Readel.");
    };
  }


// Plays the current audio buffer and prefetches the next sentence
// Revised playAudio function to handle buffer playback and manage source
async function playAudio(buffer) {
    if (playing){
        if (!buffer) return;

        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        if (source) {
            source.disconnect();
        }

        source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
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
    }else{
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
    const response = await chrome.runtime.sendMessage({action: 'getCredits', amount: sentences[currentIndex].length});
    if (response.message === 'OUTOFCREDITS') {
        alert("Sorry, Readel has ran out of credits.");
        handleUIChange(false);
        playing = false;
        return;
    } else if (response.message === 'ok') {
        if (!audioBuffers[currentIndex]) {
            audioBuffers[currentIndex] = await QueueAudio(sentences[currentIndex]);
        }
        await playAudio(audioBuffers[currentIndex]);

        // Prefetch the next sentence if it exists
        if (currentIndex + 1 < sentences.length && !audioBuffers[currentIndex + 1]) {
            await setCharacter(sentences[currentIndex].length);
            audioBuffers[currentIndex + 1] = await QueueAudio(sentences[currentIndex + 1]);
        }
    } else {
        alert("There has been an error playing the audio.");
    }
}

function PauseAudio(){
    if (!source) return; // Ensure there's a source to pause
    handleUIChange(false);
    source.stop();
    playing = false;
    playbackPosition = audioCtx.currentTime - source.startTime; // Update playback position based on current time and start time
}

async function QueueAudio(text) {
    let audioData = await fetchTTS(text, currentIndex);
    return new Promise((resolve, reject) => {
        audioCtx.decodeAudioData(audioData, buffer => {
            resolve(buffer); // Resolve after setting buffer
        }, error => {
            console.error('Error decoding audio data:', error);
            reject(error);
        });
    });
}

async function fetchTTS(sentence, currentSentenceIndex) {
  try {
    const { voice, quality } = await fetchVoiceAndQualitySettings();
    let url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${sentence}&index=${currentSentenceIndex}&voice=${voice}&quality=${quality}`;
    const res = await fetch(url);
    const data = await res.json()
    

    return base64ToArrayBuffer(data.audioBase64);
  } catch (error) {
    console.error('Error in fetchTTS:', error);
    throw error;  // Re-throw the error for further handling if necessary
  }
}

// FYI, fetches once per instance. Doesn't check every sentence. Not sure if I want to change
// too allow for speed changes for longer form content.
function fetchVoiceAndQualitySettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['voiceID', 'qualityID'], function(items) {
        const voice = items.voiceID || 'robert';
        const quality = items.qualityID || 'low';
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
function handleUIChange(isPlaying){
    if (isButtonInejcted){
        buttonDiv.innerHTML = '';
        const label = document.createElement('span');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.alignItems = 'center';
        buttonDiv.style.justifyContent = 'center';
        const icon = document.createElement('div');
        label.style.fontSize = '16px';
        label.style.marginLeft = '5px';
        label.style.marginRight = '5px';
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.fontSize = '16px';
        if (isPlaying){
            audioController.style.width = '35px';
            audioController.style.backgroundColor = 'rgba(255, 248, 18, 1)';
            cont.style.right = '80px';
            volumeControl.style.right = '30px';
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="14" width="8.75" viewBox="0 0 320 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"/></svg>`
            icon.appendChild(label);
            buttonDiv.appendChild(icon);

            chrome.runtime.sendMessage({action: true});
        }else if (!isPlaying) {
            audioController.style.backgroundColor = 'rgba(255, 248, 18, 0.7)';
            audioController.style.width = '100px';
            volumeControl.style.right = '95px';
            cont.style.right = '145px';
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="14" width="10.5" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`
            label.textContent = "Readel";
            icon.appendChild(label);
            buttonDiv.appendChild(icon);

            chrome.runtime.sendMessage({action: false});
        }
    }else {
        if (isPlaying){
            chrome.runtime.sendMessage({action: true});
        }else if (!isPlaying){
            chrome.runtime.sendMessage({action: false});
        }
    }
 
}

function setCursorToWait(isLoading){
    if (isLoading){
        const style = document.createElement("style");
        style.id = "corsor_wait";
        style.innerHTML = "* {cursor: wait;}"
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
async function setCharacter(length){
  chrome.storage.sync.get('user', function(result) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    if (result.user === undefined){
      return;
    }


    const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setCharacters?user=${result.user}&updateChar=${length}`;
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${result}`,
      },
    })
    .then(response => response.json())
    .catch(error => {
      console.error('Error fetching user info:', error);
    });
  });
  return;
}

function fetchFromSelectedText(text, selectedText){
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
    sentences = sentences.map(sentence => sentence.trim()); // Trim each sentence
    return sentences;
}


function getPageText() {
    const article = document.querySelector('article');
    let combinedText = '';

    if (article) {
        combinedText = article.innerText;
    } else {
        const tags = ['h1', 'p', 'li'];
        tags.forEach(tag => {
            const elements = document.querySelectorAll(tag);
            elements.forEach(element => {
                combinedText += element.innerText + " ";
            });
        });
    }
    combinedText = combinedText.trim(); // Trim the combined text here
    return splitIntoSentences(combinedText);
}

async function getUser(){
    return new Promise((resolve) => {
        chrome.storage.sync.get('user', async function(items) {
        if (items.user === undefined){
            alert("Oh no, you are not signed in! Click on 'Readel' in the Extensions tab to sign in.");
            resolve({return: false});
        }
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            resolve({return: false});
        }
        })
        resolve({return: true});
    });
}

async function getTabUrl(){
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({action: 'getTabUrl' }, async function(response){
            // console.log(response);
            resolve(response)
        })
    })
}

async function injectButton(){
    const sentences = getPageText();
    let totalCharacters = await sentences.reduce((acc, sentence) => acc + sentence.length, 0);
    const url = await getTabUrl()
    if (totalCharacters >= 800 && !(url.includes("www.youtube.com") || url.includes("chat.openai.com"))) {
        isButtonInejcted = true;
        AudioPlayerButton();
    }
}

function skipButtonUI(){

    const skipFoward = document.createElement('button');
    skipFoward.textContent = "->"
    skipFoward.style.position = 'fixed';
    // audioContainer.style.backgroundColor = "yellow";
    skipFoward.style.bottom = '150px';
    skipFoward.style.right = '40px';
    skipFoward.style.height = '20px';
    skipFoward.style.zIndex = '10000';

    document.body.appendChild(skipFoward);

    skipFoward.addEventListener('click', function(){
        currentIndex += 1;
        handleAudioPlay();
    })

}

// Load script onto page.
injectButton();