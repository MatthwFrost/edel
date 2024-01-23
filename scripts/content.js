// Set this as global, need access to the bad boy's.
let source;
let sentences;
const DEBUG = true;
function debubgLog(...message){
  if (DEBUG) {
    console.log(...message);
  }
} 

chrome.runtime.onMessage.addListener(
  function(request) {
    if (request.greeting === "clicked") {
      // Check for invalid characters in the string, and sanitize it.
      let text = window.getSelection().toString().trim();
      sanitizeAndProcessText(text);
    } else if (request.greeting === "stop") {
      // Reset the sentences array, and stop the audio.
      sentences = [];
      stopAudio(source);
    }
  }
);

function sanitizeAndProcessText(selectedText) {
  // Sanitize the selected text
  let sanitizedText = sanitiseInput(selectedText);

  if (sanitizedText.length > 2 || sanitizedText.length > 1000) {
    getSpeechElevenLabs(sanitizedText);
  } else {
    alert(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitizedText.length})`);
    console.error(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitizedText.length})`);
  }
}

// Stop audio source from playing
function stopAudio(source){
  source.stop();
  chrome.runtime.sendMessage({action: false});
  debubgLog("Audio stopped");
}

// Sanitise the selected text and then return the corrected text. 
function sanitiseInput(text){
  return text.replace(/[^a-zA-Z0-9\s\.,;:'"!?(){}\[\]<>-]/g, '');
}

async function getSpeechElevenLabs(text) {
  // Show that the function is loading on cursor.
  setCursorToWait();

  // Let background.js know to set the "stop" context menu.
  chrome.runtime.sendMessage({action: true});

  // Split text into sentences. This is a simple regex-based approach.
  sentences = splitIntoSentences(text);

  // Set variables for the loop.
  let currentSentenceIndex = 0; // Index of the sentence currently being played
  let nextAudioData;            // Prefetched audio data for the next sentence

  // Find the next sentence to play, and play it.
  async function playNextSentence() {
    
    // Timing FOR DEBUG.
    let start;
    if (DEBUG){
      start = Date.now();
    }

    // Check if the if we've reached the end of the sentences array.
    if (currentSentenceIndex < sentences.length) {
      const sentence = sentences[currentSentenceIndex];
      let audioData;

      // Is there new audio to play?
      if (nextAudioData) {
        audioData = nextAudioData;              // Use prefetched audio
        nextAudioData = null;                   // Reset prefetch audio
      } else {
        audioData = await fetchTTS(sentence);   // Fetch TTS for the current sentence if not prefetched
      }

      playAudio(audioData, async () => {
        currentSentenceIndex++;
        await playNextSentence();               // Play next sentence after current one ends
      });

      // FOR DEBUG
      debubgLog(`Playing sentence ${currentSentenceIndex + 1} of ${sentences.length}`);
      const end = Date.now();
      debubgLog(`Execution time: ${end - start} ms`);
      await prefetchNextSentence();             // Prefetch the next sentence
    } else {
      // All sentences have been played
      chrome.runtime.sendMessage({action: false});
    }
  }

  async function prefetchNextSentence() {
    if (currentSentenceIndex + 1 < sentences.length) {
      nextAudioData = await fetchTTS(sentences[currentSentenceIndex + 1]);
    }
  }

  playNextSentence();
  await prefetchNextSentence(); // Start prefetching the first sentence
  setCursorToDefault();
}

async function fetchTTS(sentence) {
  const url = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/?sentence=${sentence}`;
  const res = await fetch(url);
  const data = await res.json();
  return base64ToArrayBuffer(data.audioBase64); 
}

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
  });
}

function splitIntoSentences(text) {
  // Split text into sentences. This is a simple regex-based approach.
  // You might need a more sophisticated method for complex texts.
  return text.match(/[^.;:\n!?]+[.;:\n!?]+/g) || [];
}


function base64ToArrayBuffer(base64) {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    console.log(bytes.buffer);
    return bytes.buffer;
}

function setCursorToWait(){
  const style = document.createElement("style");
  style.id = "corsor_wait";
  style.innerHTML = "* {cursor: wait;}"
  document.head.insertBefore(style, null);
}

function setCursorToDefault(){
  document.getElementById("corsor_wait").remove();
}
