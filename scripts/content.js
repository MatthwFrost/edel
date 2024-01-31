// Handles most of the application logic.
// ---------------------------------------------
// What happens:
//  - Gets the text selection and then 'sanitises' it. --- There's a need for more complicated 'sanitise' function.
//  - Splits the text into sentences.
//  - Fetches the audio data for each sentence.
//  - Plays the audio data for each sentence.


// Set this as global, need access to the bad boy's.
let source;
let sentences;
const MAX_CHARACTER_LENGTH = 5000;


// Too console.log or not to console.log
const DEBUG = true;
function debugLog(...message){
  DEBUG ? console.log(...message) : null;
} 

// Checks which option the user clicks on the context menu
// Listens to background.js for a request. Either "Clicked" or "Stop".
// Main. Begins whole program.
chrome.runtime.onMessage.addListener(function(request) {
  if (request.greeting === "clicked") {                   // Starts the audio fetching process.
    let text = window.getSelection().toString().trim();
    sanitiseInput(text);
  } else if (request.greeting === "stop") {
    sentences = [];
    stopAudio(source);
  } else if (request.greeting === "out"){
    alert("Out of characters");
  } else if (request.reddit === true){
    // setRedditPlayButton();
    console.log("REDDIT PAGE FOUND");
  }
});

// Sanitise the selected text and then return the corrected text. 
function sanitiseInput(text){
  sanitisedText = text.replace(/[^a-zA-Z0-9\s\.,;:'"!?(){}\[\]<>-]/g, '');

  if (sanitisedText.length < MAX_CHARACTER_LENGTH) {
    getSpeechElevenLabs(sanitisedText);
  } else {
    alert(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    console.error(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    setError('Too many characters selected.');
  }
}

// Stop audio source from playing
function stopAudio(source){
  source.stop();
  chrome.runtime.sendMessage({action: false});
  debugLog("Audio stopped");
}

// Main function.
async function getSpeechElevenLabs(text) {
  setCursorToWait();    // Let background.js know to set the "stop" context menu.

  chrome.runtime.sendMessage({action: true});   // Let background.js know to set the "stop" context menu.

  sentences = splitIntoSentences(text);   // Split text into sentences. This is a simple regex-based approach.

  // Set variables for the loop.
  let currentSentenceIndex = 0; // Index of the sentence currently being played
  let nextAudioData;            // Prefetched audio data for the next sentence
  let sentence;                 // Current sentence being played

  // Find the next sentence to play, and play it.
  async function playNextSentence() {
    
    // Timing FOR DEBUG.
    let start;
    if (DEBUG){
      start = Date.now();
    }

    // Check if the if we've reached the end of the sentences array.
    if (currentSentenceIndex < sentences.length) {
      sentence = sentences[currentSentenceIndex];
      let audioData;

      // Is there new audio to play?
      if (nextAudioData) {
        audioData = nextAudioData;              // Use prefetched audio
        nextAudioData = null;                   // Reset prefetch audio
      } else {
        audioData = await fetchTTS(sentence, currentSentenceIndex);   // Fetch TTS for the current sentence if not prefetched
      }

      playAudio(audioData, async () => {
        currentSentenceIndex++;
        await playNextSentence();               // Play next sentence after current one ends
      });

      await setCharacter(sentence.length)

      // FOR DEBUG
      debugLog(`Playing sentence ${currentSentenceIndex + 1} of ${sentences.length}`);
      const end = Date.now();
      debugLog(`Execution time: ${end - start} ms`);
      await prefetchNextSentence();             // Prefetch the next sentence
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

async function setCharacter(length){
  chrome.storage.local.get('user', function(result) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
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
      const voice = items.voiceID || 'old-british-man';
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

    let url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/?sentence=${sentence}&index=${currentSentenceIndex}&voice=${voice}&quality=${quality}`;
    debugLog(url);

    const res = await fetch(url);
    const data = await res.json();
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
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.decodeAudioData(audioData, buffer => {
    source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.addEventListener('ended', onEnded);
    source.start();
  }, error => {
    console.error('Error decoding audio data:', error);
    setError(error);
  });
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

// REDDIT SECTION
// ---------------------
// Checks if we are on a reddit comment section and then puts a play button there.
// Logged out state is different to logged in state.

document.addEventListener('DOMContentLoaded', function() {
  let lastKnownUrl; 
  let shouldAddButton;
  // Also research observers.
  const observer = new MutationObserver(mutations => {
    for (let mutation of mutations) {
      if (mutation.type === 'childList') {
          // Check if the URL has actually changed
          if (location.href !== lastKnownUrl) {
              lastKnownUrl = location.href;
              const redditCommentsRegex = /^https:\/\/www\.reddit\.com\/r\/[^\/]+\/comments\/[^\/]+\/[^\/]+/;
              if (redditCommentsRegex.test(this.location.href)) {
                  // Perform your actions for Reddit comment URLs
                  console.log("Reddit site detected on tab");
                  shouldAddButton = true;
              }else {
                shouldAddButton = false;
              }
          }
      }
      }
      if (shouldAddButton) {
        setRedditPlayButton();
      }
  });

  observer.observe(document.body, {
      childList: true,
      subtree: true
  });

});

function setRedditPlayButton() {
  const postContent = document.querySelector('div[data-test-id="post-content"]');
  if (postContent) {
      // Check if the play button already exists
      if (!postContent.querySelector('.custom-play-button')) {
          const playButton = document.createElement('button');
          playButton.textContent = '▶ Play';
          playButton.classList.add('custom-play-button');
          playButton.style.marginTop = '10px'; // Example styling

          // Event listener for the play button
          playButton.addEventListener('click', () => {
              // Logic to handle play button click
              console.log('Play button clicked');
              // console.log(postContent.textContent);
              const postDetails = extractRedditPostDetails();
              console.log(postDetails.title, postDetails.text)
          });

          // Insert the play button
          postContent.appendChild(playButton);
      }
  }
}

function extractRedditPostDetails() {
  const titleElement = document.querySelector('._2SdHzo12ISmrC8H86TgSCp h1');
  const title = titleElement ? titleElement.textContent : null;

  const usernameElement = document.querySelector('[data-testid="post_author_link"]');
  const username = usernameElement ? usernameElement.textContent : null;

  // Define the CSS selector for the container holding the text
  const textContainerSelector = '._3xX726aBn29LDbsDtzr_6E._1Ap4F5maDtT1E1YuCiaO0r.D3IL3FD0RFy_mkKLPwL4 ._292iotee39Lmt0MkQZ2hPV.RichTextJSON-root';

  // Use the selector to find the container
  const textContainer = document.querySelector(textContainerSelector);

  // Initialize an empty string to hold the extracted text
  let text = '';

  // Check if the container is found
  if (textContainer) {
      // Extract and concatenate the text from each paragraph
      textContainer.querySelectorAll('p').forEach(p => {
          text += p.textContent.trim() + '\n\n';
      });
  }

  return { title, username, text};
}
// For the future
// function setParagraphPlayButton(){
  
//   var cssAnimation = `
//   @keyframes exampleAnimation {
//     0% { opacity: 0; }
//     100% { opacity: 1; }
//   }

//   .button-15 {
//     animation-name: exampleAnimation;
//     animation-duration: 0.2s;
//     animation-fill-mode: forwards;
//     background-color: #FFFFFF;
//     border: 1px solid #222222;
//     border-radius: 8px;
//     box-sizing: border-box;
//     color: #222222;
//     cursor: pointer;
//     display: inline-block;
//     font-family: Circular,-apple-system,BlinkMacSystemFont,Roboto,"Helvetica Neue",sans-serif;
//     font-size: 12px;
//     font-weight: 600;
//     line-height: 20px;
//     margin: 0;
//     outline: none;
//     padding: 3px 13px;
//     position: relative;
//     text-align: center;
//     text-decoration: none;
//     touch-action: manipulation;
//     transition: box-shadow .2s,-ms-transform .1s,-webkit-transform .1s,transform .1s;
//     user-select: none;
//     -webkit-user-select: none;
//     width: auto;
//   }
  
//   .button-15:focus-visible {
//     box-shadow: #222222 0 0 0 2px, rgba(255, 255, 255, 0.8) 0 0 0 4px;
//     transition: box-shadow .2s;
//   }
  
//   .button-15:active {
//     background-color: #F7F7F7;
//     border-color: #000000;
//     transform: scale(.96);
//   }
  
//   .button-15:disabled {
//     border-color: #DDDDDD;
//     color: #DDDDDD;
//     cursor: not-allowed;
//     opacity: 1;
//   }
//   `;


//   var styleSheet = document.createElement('style');
//   styleSheet.type = 'text/css';
//   styleSheet.innerText = cssAnimation;
//   document.head.appendChild(styleSheet);

//   var hoverButton = document.createElement('button');
//   hoverButton.innerHTML = "▶️";
//   hoverButton.id = 'button-15'; // Assign an ID for easier CSS targeting
//   hoverButton.style.position = 'absolute';
//   hoverButton.style.zIndex = '999';
//   hoverButton.style.display = 'none'; // Initially hidden
//   document.body.appendChild(hoverButton); // Append to body


//   var paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a');
//   var currentParagraph = null;
//   var timer;
//   var hoverButton;
  
//   paragraphs.forEach(function(paragraph) {
    
//     if (paragraph.innerText.length > 30 || paragraph.innerText.length === null) {
//       paragraph.addEventListener('mouseover', function() {
//           currentParagraph = paragraph.innerText;
//           paragraph.style.backgroundColor = 'rgba(117, 184, 200, .1)';
//           paragraph.style.borderRadius = '5px';
//           paragraph.style.zIndex = '998';
//           clearTimeout(timer);
//           var rect = paragraph.getBoundingClientRect();
//           let left = rect.left - 50;
//           hoverButton = document.getElementById('button-15');
//           hoverButton.style.display = 'block';
//           hoverButton.classList.add('button-15');
//           paragraph.appendChild(hoverButton);
//       });

//       paragraph.addEventListener('mouseout', function() {
//           timer = setTimeout(function() {
//             var button = document.getElementById('button-15');
//             if (!button.matches(':hover')) {
//               button.style.display = 'none';
//             }
//           }, 500); // Delay of 500 ms
//           paragraph.style.backgroundColor = '#fff';
//           paragraph.style.opacity = '1';
//       });
//     }
//   });

//   hoverButton.addEventListener('mouseover', function() {
//     clearTimeout(timer);
//     this.style.display = 'block';
//   });

//   hoverButton.addEventListener('mouseout', function() {
//       var self = this;
//       timer = setTimeout(function() {
//           self.style.display = 'none';
//       }, 1000);
//   });

//   hoverButton.addEventListener('click', function() {
//       sanitizeAndProcessText(currentParagraph);
//   }); 
// }