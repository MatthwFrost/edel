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
  return text.replace(/[^a-zA-Z0-9\s\.,;:'"!?(){}[\]<>]/g, '').replace(/"/g, '\\"');
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
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices.lily}/${METHOD}?optimize_streaming_latency=${STREAMINGLATENCY}`, options);
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

// document.addEventListener('DOMContentLoaded', () => {
//   // Insert where ever there is an article
//   const article = document.querySelector("article");
//   console.log(article);

//   // `document.querySelector` may return null if the selector doesn't match anything.
//   if (article) {
//     const text = article.textContent;
//     const wordMatchRegExp = /[^\s]+/g; // Regular expression
//     const words = text.matchAll(wordMatchRegExp);
//     // matchAll returns an iterator, convert to array to get word count
//     const wordCount = [...words].length;
//     const readingTime = Math.round(wordCount / 200);
//     const badge = document.createElement("p");
//     // Use the same styling as the publish information in an article's header
//     badge.classList.add("color-secondary-text", "type--caption");
//     badge.textContent = `⏱️ ${readingTime} min read`;

//     // Support for API reference docs
//     const heading = article.querySelector("h1");
//     // Support for article docs with date
//     const date = article.querySelector("time")?.parentNode;

//     (date ?? heading).insertAdjacentElement("afterend", badge);
//   }
// });