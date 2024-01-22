// Set this as global, need access to the bad boy.
let source;
let sentences;

chrome.runtime.onMessage.addListener(
  function(request) {
    if (request.greeting === "clicked") {
      // Check for invalid characters in the string, and sanitize it.
      let text = window.getSelection().toString().trim();
      sanitizeAndProcessText(text);
    } else if (request.greeting === "stop") {
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
  console.log("Stopping");
  chrome.runtime.sendMessage({action: false});
}

// Sanitise the selected text and then return the corrected text. 
function sanitiseInput(text){
  // Replace characters other than alphanumeric, spaces, and common punctuation with an empty string

  return text.replace(/[^a-zA-Z0-9\s\.,;:'"!?(){}[\]<>]/g, '').replace(/"/g, '\\"');
}

async function setRecentAudio(data, selectedText){
  const query = 'https://28cxldb6ed.execute-api.eu-central-1.amazonaws.com/dev/processAudioData';

  var arrayBuffer = _arrayBufferToBase64(data);
  const body = {
    "userID": "Matt",
    "arrayBuffer": arrayBuffer,
    "text": selectedText,
  }

  await fetch(query, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  .then(response => response.json())
  .then(data => {
    console.log(data);
  })
};

function _arrayBufferToBase64( buffer ) {
  var binary = '';
  var bytes = new Uint8Array( buffer );
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
  }
  return window.btoa( binary );
}

async function getSpeechElevenLabs(text) {
  setCursorToWait();
  chrome.runtime.sendMessage({action: true});
  sentences = splitIntoSentences(text);
  let currentSentenceIndex = 0;
  let nextAudioData; 

  async function playNextSentence() {
    const start = Date.now();
    if (currentSentenceIndex < sentences.length) {
      const sentence = sentences[currentSentenceIndex];
      let audioData;

      if (nextAudioData) {
        audioData = nextAudioData; // Use prefetched audio
        nextAudioData = null; // Reset prefetch audio
      } else {
        audioData = await fetchTTS(sentence); // Fetch TTS for the current sentence if not prefetched
      }

      playAudio(audioData, async () => {
        currentSentenceIndex++;
        await playNextSentence(); // Play next sentence after current one ends
      });

      console.log(`Playing sentence ${currentSentenceIndex + 1} of ${sentences.length}`);
      const end = Date.now();
      console.log(`Execution time: ${end - start} ms`);
      await prefetchNextSentence(); // Prefetch the next sentence
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

  // Timing FOR DEBUG
  let EL_API_KEY = '1a2411f0a67edc064394ae22239f7aa9';

  const voices = {
    old_british_man: "fjUEyxiEBGhIdIzLmVus",
    lily: "pFZP5JQG7iQjIQuC4Bku",
    myOwnVoice: "iCFUKc3rB6sfwKZLdamJ",
  }

  let STREAMINGLATENCY= 3;
  let METHOD = 'stream';

  const options = {
    method: 'POST',
    headers: {
      'xi-api-key': EL_API_KEY, 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: sentence,
      model_id: "eleven_turbo_v2",
      stability: 30 
    }),
  };

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices.old_british_man}/${METHOD}?optimize_streaming_latency=${STREAMINGLATENCY}`, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.arrayBuffer();  // This should convert the response to an ArrayBuffer
  } catch (error) {
    console.error('Error fetching TTS data:', error);
    throw error;  // Rethrow the error to handle it in the calling function
  }

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

function setCursorToWait(){
  const style = document.createElement("style");
  style.id = "corsor_wait";
  style.innerHTML = "* {cursor: wait;}"
  document.head.insertBefore(style, null);
}

function setCursorToDefault(){
  document.getElementById("corsor_wait").remove();
}