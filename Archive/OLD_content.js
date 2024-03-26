// Handles most of the application logic.
// ---------------------------------------------
// What happens:
//  - Gets the text selection and then 'sanitises' it. --- There's a need for more complicated 'sanitise' function.
//  - Splits the text into sentences.
//  - Fetches the audio data for each sentence.
//  - Plays the audio data for each sentence.

// Set this as global, need access to the bad boy's.
// Check if the script has already been injected



/**
  @Injection This section runs when script is ijected.
------------------------------------------------------------------------------------------------------------------------------------------
 */

if (typeof(source) === 'undefined') {
  let source;
  let audioContext;
  let audioBuffer;
} 
if (typeof(sentences) === 'undefined') {
  let sentences;
} 
if (typeof(latest_sentence) === 'undefined') {
  let latest_sentence;
} 


let currentSentenceIndex = 0; // Index of the sentence currently being played
// Too console.log or not to console.log
function debugLog(...message){
  DEBUG ? console.log(...message) : null;
} 

// let queue;
let DEBUG = false;
let queue;
let audioBuffer;
const tags = ['h1', 'p', 'li']; // Define the tags you're interested in
let combinedText = ''; // String to hold the combined text content

tags.forEach(tag => {
    const elements = document.querySelectorAll(tag); // Get all elements for the current tag
    elements.forEach(element => {
        combinedText += element.innerText + " "; // Concatenate the text content with a space
    });
});
if (combinedText.length > 30){
  // Create the play button container
  var playButtonContainer = document.createElement('div');
  playButtonContainer.style.position = 'fixed';
  playButtonContainer.style.bottom = '100px';
  playButtonContainer.style.right = '20px';
  playButtonContainer.style.height = '40px';
  playButtonContainer.style.backgroundColor = '#FFF407'; // Example color
  playButtonContainer.style.borderRadius = '30px 30px 0 30px'; // Rounded edges
  playButtonContainer.style.display = 'flex';
  playButtonContainer.style.justifyContent = 'center';
  playButtonContainer.style.alignItems = 'center';
  playButtonContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  playButtonContainer.style.cursor = 'pointer';
  playButtonContainer.style.zIndex = '1000'; // Ensure it's above most elements
  playButtonContainer.style.transition = 'width 0.5s ease'; // Smooth transition for width
  playButtonContainer.style.overflow = 'hidden'; // Hide overflow content
  playButtonContainer.style.width = '40px'; // Initial width

  // Create the play icon using SVG
  var playIcon = document.createElement('div');
  playIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#000000" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  playIcon.paddingLeft = '25px';
  // Adjustments to playIcon for centering, if necessary
  playIcon.style.margin = '3px 0px 0px 3px'; // Center horizontally
  playIcon.style.display = 'block';
  playButtonContainer.appendChild(playIcon);

  // Create the text label for "Play"
  var playLabel = document.createElement('span');
  playLabel.textContent = 'Play';
  playLabel.style.fontFamily = 'Circular,-apple-system,BlinkMacSystemFont,Roboto,"Helvetica Neue",sans-serif';
  playLabel.style.marginLeft = '10px';
  playLabel.style.fontWeight = 'bold';
  playLabel.style.display = 'none'; // Initially hidden
  playButtonContainer.appendChild(playLabel);

  // Expand button and show label on hover
  playButtonContainer.addEventListener('mouseenter', function() {
      playButtonContainer.style.width = '100px'; // Initial width
      playLabel.style.display = 'block'; // Hide label
  });

  // Collapse button and hide label on mouse leave
  playButtonContainer.addEventListener('mouseleave', function() {
      playButtonContainer.style.width = '40px'; // Initial width
      playLabel.style.display = 'none'; // Hide label
  });

  // Add functionality to the button (e.g., playing audio)
  let playing = false;
  let playbackPosition = 0;

  audioContext = new window.AudioContext || window.webkitAudioContext;
  source = audioContext.createBufferSource();
  source.connect(audioContext.destination);
  // source.addEventListener('ended', onEnded);

  let text = fetchFromSelectedText(combinedText, combinedText);
  sentences = splitIntoSentences(text);   // Split text into sentences. This is a simple regex-based approach.

  playButtonContainer.addEventListener('click', function() {
    playing = !playing;
    // console.log('Play button clicked');
    // Add your play functionality here

    if (!playing){
      playIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#000000" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      playIcon.style.margin = '3px 0px 0px 3px'; // Center horizontally
      playLabel.textContent = 'Play';
      playButtonContainer.appendChild(playIcon);
      playButtonContainer.appendChild(playLabel);
      playbackPosition += audioContext.currentTime - source.startTime;
      stopAudio(source, audioContext);
      source = null;
      playing = false;
    }else {
      playIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#000000" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>'
      playIcon.style.margin = '3px 0px 0px 0px'; // Center horizontally
      playLabel.textContent = 'Pause';
      playButtonContainer.appendChild(playIcon);
      playButtonContainer.appendChild(playLabel);

      // const text = window.getSelection().toString().trim(); // Get selected text
      audioHandler(sentences, source, audioContext);
      // if (typeof(source) === 'undefined'){
      //   console.log("Source is undefined");
      //   beginAudioFetch(combinedText);
      // }else{
      //   if (audioContext && source && source.elapsedTime !== undefined) {
      //     console.log(audioContext, source, source.elapsedTime);
      //     startPlayback(playbackPosition, audioContext, source, audioBuffer);
      //   }
      // }
    }
  });

  async function audioHandler(sentences, source, audioContext){
    console.log("Init audio.");
    // If its the first time playing the audio, handle text stripping
    // Source is a good way to check. What else?
    // Audio buffer tells us if theres something loaded.
    // How will the audio be play continuosly?
    // Recursion. and if the stream is ended. clear the buffer.

    // First time or speech ended previously.
    if (!source.buffer){                                    // Fetch audio if none is in buffer.
      await getSpeech(sentences, source, audioContext).then(() => {
        console.log("init: ", source.buffer);
        audioHandler(null, source, null);
      })
    } else {                                                // Play audio in buffer.
      console.log("Audio buffer has stuff: ", source.buffer);
      playHandler(source, audioContext);
    }
  };
  
  // I cant send audioContext for some reason.
  function playHandler(source, audioContext){
      source.start();
  }

  function startPlayback(startPosition, audioContext, source, audioBuffer) {
    if (audioBuffer) {
      console.log("starting playback")
      source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.startTime = audioContext.currentTime - startPosition; // Correct start time with the offset
      source.start(0, startPosition);
      source.onended = async function() {
        console.log("Source ended");
        const text = fetchFromSelectedText(combinedText, latest_sentence);
        // beginAudioFetch(text);
        sentences = splitIntoSentences(text);   // Split text into sentences. This is a simple regex-based approach.
        await getSpeech(sentences, audioContext, source);
        startPlayback();
        // Handle what happens when the audio ends
        // isPlaying = false;
        // playbackPosition = 0; // Reset or adjust as needed
        // updatePlayButtonUI(false);
      };
      // Update UI to show pause icon
      // updatePlayButtonUI(true);
    } else {
      // Fetch or alert that there's no audio loaded
      console.log("No audio loaded.");
    }
  }

  // Append the play button container to the body
  document.body.appendChild(playButtonContainer);
}


//----------------------------------------------------------------------------------------------------------------------------------------

/**
  @function listens for messages sent from the backend.
  @params request includes what type of message is sent.
  @return Initiats the correct function for the backend request.
**/
chrome.runtime.onMessage.addListener(function(request) {
  if (request.greeting === "clicked") {                   // Starts the audio fetching process.
      const text = window.getSelection().toString().trim(); // Get selected text
      if (typeof(source) === 'undefined'){
        beginAudioFetch(text);
      }else{
        const newSource = audioContext.createBufferSource();
        newSource.buffer = source.buffer;
        newSource.connect(audioContext.destination);

        // Define an event listener for when the audio playback ends
        newSource.onended = function() {
          // Audio playback ended, prefetch the next audio data
          playNextSentence();
        };
        // Start playback from the stored elapsed time
        newSource.start();
        // Update the original source reference
        source = newSource;
      }
  } else if (request.greeting === "stop") {
      stopAudio(source);
  } else if (request.greeting === "out"){
      alert("Edel has ran out of characters");
  } else if (request.reddit === true){
      debugLog("REDDIT PAGE FOUND");
      setRedditPlayButton();
  }else if (request.install === "error"){
    alert("There has been an error with you install. Please contact our support.")
  }else if (request.error === "connection-error"){
    alert("There was an error, please try again.")
  }
});


/**
  @funtion Entry point for text-to-speech.
  @param text 
 */
function beginAudioFetch(text){
  sanitisedText = text.replace(/[^a-zA-Z0-9\s\.,;:'"(){}\[\]!?]/g, '');
  text = combinedText.replace(/[^a-zA-Z0-9\s\.,;:'"(){}\[\]!?]/g, '');
  const playFrom = fetchFromSelectedText(text, sanitisedText);
  const MAX_CHARACTER_LENGTH = 1000000;

  if (sanitisedText.length < MAX_CHARACTER_LENGTH) {
    getSpeechElevenLabs(playFrom);
  } else {
    alert(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    console.error(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    setError('Too many characters selected.');
  }
};

async function getSpeech(sentences, source, audioContext){
  // setCursorToWait();    // Let background.js know to set the "stop" context menu.
  chrome.runtime.sendMessage({action: true});   // Let background.js know to set the "stop" context menu.

  let sentence = sentences[currentSentenceIndex];
  audioData = await fetchTTS(sentence, 0);   // Fetch TTS for the current sentence if not prefetched
  await audioContext.decodeAudioData(audioData, buffer => {
    source.buffer = buffer;
  }, error => {
    console.error('Error decoding audio data:', error);
    setError(error);
  });
  currentSentenceIndex++;
}

/**
  Call AWS Lambda function, fetchAudio.
  @param text - split into individual sentences.
  @return Plays audio with web audio API
**/
async function getSpeechElevenLabs(text) {
  setCursorToWait();    // Let background.js know to set the "stop" context menu.

  chrome.runtime.sendMessage({action: true});   // Let background.js know to set the "stop" context menu.
  
  sentences = splitIntoSentences(text);   // Split text into sentences. This is a simple regex-based approach.

  // Set variables for the loop.
  let nextAudioData;            // Prefetched audio data for the next sentence

  // Find the next sentence to play, and play it.
  async function playNextSentence() {
    
    // Timing FOR DEBUG.
    let start;
    if (DEBUG) {
      start = Date.now();
    }

    // Check if the if we've reached the end of the sentences array.
    if (currentSentenceIndex < sentences.length) {
      // highlightSentence(sentence);
      await chrome.runtime.sendMessage({action: 'getCredits', amount: sentences[currentSentenceIndex].length }, async function(response){
        if (response.message === 'OUTOFCREDITS'){
          alert("Sorry, Edel has ran out of credits.");
        }else if(response.message === 'ok'){
          let sentence = sentences[currentSentenceIndex];

          latest_sentence = sentence;
          // highlightText(sentence);
          let audioData;

          // Is there new audio to play?
          if (nextAudioData) {
            audioData = nextAudioData;              // Use prefetched audio
            nextAudioData = null;                   // Reset prefetch audio
          } else {
            audioData = await fetchTTS(sentence, currentSentenceIndex);   // Fetch TTS for the current sentence if not prefetched
          }

          playAudio(audioData,async () => {
            currentSentenceIndex++;
            await playNextSentence();               // Play next sentence after current one ends
          });

          await setCharacter(sentence.length)

          // FOR DEBUG
          debugLog(`Playing sentence ${currentSentenceIndex + 1} of ${sentences.length}`);
          const end = Date.now();
          debugLog(`Execution time: ${end - start} ms`);
        } else {
          alert("There has been an error.")
        }
        });
      } else {
        // All sentences have been played
        chrome.runtime.sendMessage({action: false});
      }
  }

  async function prefetchNextSentence() {
    if (currentSentenceIndex + 1 < sentences.length) {
      nextAudioData = await fetchTTS(sentences[currentSentenceIndex + 1], currentSentenceIndex);
    }
  }
  playNextSentence();
  await prefetchNextSentence(); // Start prefetching the first sentence
  setCursorToDefault();
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
      alert("Please reinstalled chrome extension.")
    }

    debugLog('Value currently is ' + result.user);

    const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setCharacters?user=${result.user}&updateChar=${length}`;
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${result}`,
      },
    })
    .then(response => response.json())
    .then(userInfo => {
      debugLog(userInfo);
    })
    .catch(error => {
      console.error('Error fetching user info:', error);
    });
  });
  return;
}

// Split text into sentences. This is a simple regex-based approach.
function splitIntoSentences(text) {
  return text.match(/[^.;:\n!?]+[.;:\n!?]+/g) || [];
}

// Get the voice and quality settings from storage.
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

// Fetch the TTS audio for a sentence. Individual sentences are sent here to be sent to scary external API.
async function fetchTTS(sentence, currentSentenceIndex) {
  try {
    const { voice, quality } = await fetchVoiceAndQualitySettings();
    debugLog('Using voice and quality:', voice, quality);

    let url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${sentence}&index=${currentSentenceIndex}&voice=${voice}&quality=${quality}`;
    debugLog(url);

    const res = await fetch(url);
    const data = await res.json()
    return base64ToArrayBuffer(data.audioBase64);
  } catch (error) {
    console.error('Error in fetchTTS:', error);
    setError(error);
    throw error;  // Re-throw the error for further handling if necessary
  }
}

// Play audio, pretty basic really.
// Web Audio API, boilderplate code.
function playAudio(audioData, onEnded) {
    // audioContext = new window.AudioContext || window.webkitAudioContext;
    audioContext.decodeAudioData(audioData, buffer => {
      audioBuffer = buffer;
      source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.addEventListener('ended', onEnded);
      source.start();
      source.startTime = audioContext.currentTime;
    }, error => {
      console.error('Error decoding audio data:', error);
      setError(error);
    });
}

// Stop audio source from playing
// Stop audio source from playing
function stopAudio(source, audioContext){
  if (audioContext && source) {
    // Stop the audio playback
    source.stop();
    // Calculate the elapsed time since playback started
    const currentTime = audioContext.currentTime;
    if (source.startTime !== undefined) {
      const elapsedTime = currentTime - source.startTime;
      // Store the elapsed time
      source.elapsedTime = elapsedTime;
      debugLog("Audio paused");
    } else {
      console.error("Source startTime is not defined");
    }
    sentences = []; // Current solution.
  }
}

// Turns the returned base64 from API, and turn into Audio ready array buffer.
function base64ToArrayBuffer(base64) {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    debugLog(bytes.buffer);
    return bytes.buffer;
}

// Pretty simple.
function setCursorToWait(){
  const style = document.createElement("style");
  style.id = "corsor_wait";
  style.innerHTML = "* {cursor: wait;}"
  document.head.insertBefore(style, null);
}

// Again, pretty simple.
function setCursorToDefault(){
  document.getElementById("corsor_wait").remove();
}

// Sets an error to storage.
// Fetches previous errors, adds new error, and then sets the new error.
function setError(newError){
  chrome.storage.local.get('error', function(result) {
    const errorData = result.error || [];
    const updatedErrorData = errorData.push(newError);
    
    chrome.storage.local.set({'error': updatedErrorData});
  });
}

function fetchFromSelectedText(text, selectedText){
  // Use indexOf for a direct substring search
  text = text.replace(/[^a-zA-Z0-9\s\.,;:'"(){}\[\]!?]/g, '');
  const searchTerm = text.indexOf(selectedText);

  // console.log("\nSelected Text:", selectedText);
  // console.log("\nFull Text:", text);
  // console.log("Search Term Index:", searchTerm);

  // Check if the selectedText is found
  if (searchTerm === -1) {
    console.log("Selected text not found in the main body of the text.");
    return ""; // or return an appropriate message or value indicating not found
  }

  // Return the substring from the found index to the end
  return text.slice(searchTerm);
}