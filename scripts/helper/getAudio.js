// NOT IN USE
// // Can't use in content script.
// send a message to background script?
// Sanitise the selected text and then return the corrected text. 
export function beginAudioFetch(source){
  const text = window.getSelection().toString().trim(); // Get selected text
  sanitisedText = text.replace(/[^a-zA-Z0-9\s\.,;:'"!?(){}\[\]<>-]/g, '');

  if (sanitisedText.length < MAX_CHARACTER_LENGTH) {
    getSpeechElevenLabs(sanitisedText);
  } else {
    alert(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    console.error(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    setError('Too many characters selected.');
  }
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
  let currentSentenceIndex = 0; // Index of the sentence currently being played
  let nextAudioData;            // Prefetched audio data for the next sentence
  let sentence;                 // Current sentence being played

  // Find the next sentence to play, and play it.
  async function playNextSentence() {
    
    // Timing FOR DEBUG.
    let start;
    if (DEBUG) {
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
