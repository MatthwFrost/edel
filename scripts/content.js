// Handles most of the application logic.
// ---------------------------------------------
// What happens:
//  - Gets the text selection and then 'sanitises' it. --- There's a need for more complicated 'sanitise' function.
//  - Splits the text into sentences.
//  - Fetches the audio data for each sentence.
//  - Plays the audio data for each sentence.

// Set this as global, need access to the bad boy's.
// Check if the script has already been injected

if (typeof(source) === 'undefined') {
  let source;
} 
if (typeof(sentences) === 'undefined') {
  let sentences;
} 
if (typeof(latest_sentence) === 'undefined') {
  let latest_sentence;
} 


// Too console.log or not to console.log
function debugLog(...message){
  DEBUG ? console.log(...message) : null;
} 

let DEBUG = false;
const tags = ['h1', 'p', 'li']; // Define the tags you're interested in
let combinedText = ''; // String to hold the combined text content

tags.forEach(tag => {
    const elements = document.querySelectorAll(tag); // Get all elements for the current tag
    elements.forEach(element => {
        combinedText += element.innerText + " "; // Concatenate the text content with a space
    });
});

// console.log("Amount of text", combinedText.length); // Log the combined text to the console

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
  playing = false;
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
      stopAudio(source);
      playing = false;
    }else {
      playIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#000000" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>'
      playIcon.style.margin = '3px 0px 0px 0px'; // Center horizontally
      playLabel.textContent = 'Pause';
      playButtonContainer.appendChild(playIcon);
      playButtonContainer.appendChild(playLabel);
      beginAudioFetch(combinedText);
      playing = true;
    }
  });

  // Append the play button container to the body
  document.body.appendChild(playButtonContainer);
}

// // Function to highlight a specific sentence on the page
// function highlightSentence(sentence) {
//   const bodyText = document.body.innerHTML;
//   const highlightedText = `<span style="background-color: yellow;">${sentence}</span>`;
//   // Replace the first occurrence of the sentence in the page with the highlighted version
//   const updatedText = bodyText.replace(sentence, highlightedText);
//   document.body.innerHTML = updatedText;
// }


/**
  Listens for messages sent from the backend.
  @params request includes what type of message is sent.
  @return Initiats the correct function for the backend request.
**/
chrome.runtime.onMessage.addListener(function(request) {
  if (request.greeting === "clicked") {                   // Starts the audio fetching process.
      const text = window.getSelection().toString().trim(); // Get selected text
      // console.log("Clicked");
      beginAudioFetch(text)
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

// Sanitise the selected text and then return the corrected text. 
function beginAudioFetch(text){
  sanitisedText = text.replace(/[^a-zA-Z0-9\s\.,;:'"(){}\[\]!?]/g, '');
  // console.log(sanitisedText.length);
  const MAX_CHARACTER_LENGTH = 1000000;
  if (sanitisedText.length < MAX_CHARACTER_LENGTH) {
    getSpeechElevenLabs(sanitisedText);
  } else {
    alert(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    console.error(`Invalid selection. Can't be greater than 1000 characters. (You selected ${sanitisedText.length})`);
    setError('Too many characters selected.');
  }
};


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
      // highlightSentence(sentence);
      await chrome.runtime.sendMessage({action: 'getCredits', amount: sentences[currentSentenceIndex].length }, async function(response){
        if (response.message === 'OUTOFCREDITS'){
          alert("Sorry, Edel has ran out of credits.");
        }else if(response.message === 'ok'){
          let sentence = sentences[currentSentenceIndex];

        latest_sentence = sentence;
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

// Stop audio source from playing
function stopAudio(source){
  sentences = [];
  source.stop();
  chrome.runtime.sendMessage({action: false});
  debugLog("Audio stopped");
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

document.addEventListener('DOMContentLoaded', function() {

  console.log("DOM HAS LOADED");
  // Inject CSS for hover effect
  const article = document.querySelector("article");
  let playing = false;

  if (article) {
    let text = "";
    const elements = article.querySelectorAll("h1, p");
    elements.forEach(element => {
      text += element.textContent + " ";
    });

    const words = [...text.matchAll(/[^\s]+/g)];
    const wordCount = words.length;
    const readingTime = Math.round(wordCount / 200);

    const timeBadge = document.createElement("p");
    timeBadge.textContent = `⏱️ ${readingTime} min read`;

    const playBadge = document.createElement("button");
    let play = playBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="12px" height="12px" viewBox="-0.5 0 7 7" version="1.1">
      <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="Dribbble-Light-Preview" transform="translate(-347.000000, -3766.000000)" fill="#000000">
              <g id="icons" transform="translate(56.000000, 160.000000)">
                  <path d="M296.494737,3608.57322 L292.500752,3606.14219 C291.83208,3605.73542 291,3606.25002 291,3607.06891 L291,3611.93095 C291,3612.7509 291.83208,3613.26444 292.500752,3612.85767 L296.494737,3610.42771 C297.168421,3610.01774 297.168421,3608.98319 296.494737,3608.57322" id="play-[#1003]"></path>
              </g>
          </g>
      </g>
      </svg> 
      Listen`

    // playBadge.style.position = "fixed";
    // playBadge.style.bottom = "20px"; // Distance from the bottom of the viewport
    // playBadge.style.left = "20px"; // Distance from the right of the viewport

    playBadge.style.backgroundColor = "#fef118";
    playBadge.style.fontSize = "16px";
    playBadge.style.margin = "5px";
    playBadge.style.width = "100px";
    playBadge.style.height= "30px";
    playBadge.style.borderRadius = "999px";
    playBadge.style.borderStyle = "none";
    playBadge.style.display = "flex";
    playBadge.style.alignItems = "center";
    playBadge.style.justifyContent = "center";
    playBadge.style.gap = "5px";
    playBadge.style.zIndex = "10000px";
    
    playBadge.addEventListener('click', function(){
      // console.log("clicked", text);
      playing = !playing;
      // beginAudioFetch(text);
      if(playing){
        playBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14px" height="14px" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.163 3.819C5 4.139 5 4.559 5 5.4v13.2c0 .84 0 1.26.163 1.581a1.5 1.5 0 0 0 .656.655c.32.164.74.164 1.581.164h.2c.84 0 1.26 0 1.581-.163a1.5 1.5 0 0 0 .656-.656c.163-.32.163-.74.163-1.581V5.4c0-.84 0-1.26-.163-1.581a1.5 1.5 0 0 0-.656-.656C8.861 3 8.441 3 7.6 3h-.2c-.84 0-1.26 0-1.581.163a1.5 1.5 0 0 0-.656.656zm9 0C14 4.139 14 4.559 14 5.4v13.2c0 .84 0 1.26.164 1.581a1.5 1.5 0 0 0 .655.655c.32.164.74.164 1.581.164h.2c.84 0 1.26 0 1.581-.163a1.5 1.5 0 0 0 .655-.656c.164-.32.164-.74.164-1.581V5.4c0-.84 0-1.26-.163-1.581a1.5 1.5 0 0 0-.656-.656C17.861 3 17.441 3 16.6 3h-.2c-.84 0-1.26 0-1.581.163a1.5 1.5 0 0 0-.655.656z" fill="#000000"/></svg> Pause`;

        // Stops the audio from resarting from beginning.
        if (latest_sentence){
          let updatedParagraph = text.replace(latest_sentence, "").trim();
          updatedParagraph = updatedParagraph.replace(/\s\s+/g, ' ');
          text = updatedParagraph.replace(/\s+([,.!?])/g, '$1');
        }

        beginAudioFetch(text);
      } else{
        playBadge.innerHTML = play;
        stopAudio(source);
      }
    })
    // Create a container for the badges
    const badgeContainer = document.createElement("div");
    badgeContainer.style.display = "flex";
    badgeContainer.style.alignItems = "center";
    badgeContainer.style.marginTop = "20px";
    badgeContainer.style.gap = "10px";
    

    // Append both badges to the container
    badgeContainer.appendChild(timeBadge);
    badgeContainer.appendChild(playBadge);

    // Simplify the selection for where to place the badges
    let insertAfterElement = article.querySelector("h1") || 
                            article.querySelector("header") || 
                            article.firstChild;

    // Insert the badgeContainer into the article
    if (insertAfterElement) {
      if (insertAfterElement === article.firstChild) {
        article.insertBefore(badgeContainer, insertAfterElement);
      } else {
        insertAfterElement.insertAdjacentElement("afterend", badgeContainer);
      }
    } else {
      // Fallback if no insert point is found
      article.appendChild(badgeContainer);
    }
  }
});




// REDDIT SECTION
// ---------------------
// Checks if we are on a reddit comment section and then puts a play button there.
// Logged out state is different to logged in state.

//document.addEventListener('DOMContentLoaded', function() {
//  let lastKnownUrl; 
//  let shouldAddButton;
//  // Also research observers.
//  const observer = new MutationObserver(mutations => {
//    for (let mutation of mutations) {
//      if (mutation.type === 'childList') {
//          // Check if the URL has actually changed
//          if (location.href !== lastKnownUrl) {
//              lastKnownUrl = location.href;
//              const redditCommentsRegex = /^https:\/\/www\.reddit\.com\/r\/[^\/]+\/comments\/[^\/]+\/[^\/]+/;
//              if (redditCommentsRegex.test(this.location.href)) {
//                  // Perform your actions for Reddit comment URLs
//                  debugLog("Reddit site detected on tab");
//                  shouldAddButton = true;
//              }else {
//                shouldAddButton = false;
//              }
//          }
//      }
//      }
//      if (shouldAddButton) {
//        setRedditPlayButton();
//      }
//  });
//
//  observer.observe(document.body, {
//      childList: true,
//      subtree: true
//  });
//
//});
//
//function setRedditPlayButton() {
//  const postContent = document.querySelector('._21pmAV9gWG6F_UKVe7YIE0');
//  postContent.style = "display: flex; justify-content: center' align-items: center;"
//    // const buttonContainer = document.querySelector('._1hwEKkB_38tIoal6fcdrt9');
//  if (postContent) {
//      // Check if the play button already exists
//      if (!postContent.querySelector('.custom-play-button')) {
//          const playButton = document.createElement('button');
//          playButton.textContent = '▶ Play Edel';
//          playButton.classList.add('custom-play-button');
//          playButton.style = "font-size: 15px; margin-left: 10px"
//
//          // Event listener for the play button
//          playButton.addEventListener('click', () => {
//              // Logic to handle play button click
//              const postDetails = extractRedditPostDetails();
//              debugLog(postDetails.title, postDetails.text)
//              const text = `${postDetails.title}. ${postDetails.text}`
//              // if (text > MAX_CHARCTERS){
//                sanitiseInput(text);
//              // }else{
//              //   alert("You have reached max characters.")
//              // }
//          });
//
//          // Insert the play button
//          postContent.appendChild(playButton);
//      }
//  }
//}
//
//function extractRedditPostDetails() {
//  const titleElement = document.querySelector('._2SdHzo12ISmrC8H86TgSCp h1');
//  const title = titleElement ? titleElement.textContent : null;
//
//  const usernameElement = document.querySelector('[data-testid="post_author_link"]');
//  const username = usernameElement ? usernameElement.textContent : null;
//
//  // Define the CSS selector for the container holding the text
//  const textContainerSelector = '._3xX726aBn29LDbsDtzr_6E._1Ap4F5maDtT1E1YuCiaO0r.D3IL3FD0RFy_mkKLPwL4 ._292iotee39Lmt0MkQZ2hPV.RichTextJSON-root';
//
//  // Use the selector to find the container
//  const textContainer = document.querySelector(textContainerSelector);
//
//  // Initialize an empty string to hold the extracted text
//  let text = '';
//
//  // Check if the container is found
//  if (textContainer) {
//      // Extract and concatenate the text from each paragraph
//      textContainer.querySelectorAll('p').forEach(p => {
//          text += p.textContent.trim() + '\n\n';
//      });
//  }
//
//  return { title, username, text};
//}