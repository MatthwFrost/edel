chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.greeting === "clicked"){
      // console.log("Clicked detected");
      var selectedText = window.getSelection().toString().trim();
      if (selectedText !== '') {
        if(selectedText.length > 1000){
          alert("Please select less than 1000 characters")
        }else{
          getSpeechElevenLabs(selectedText);
        }
      }
    }else if (request.greeting === "stop"){
      // Currently, if you want to stop. You need to refresh the page
      location.reload();
      chrome.runtime.sendMessage({action: false});
    }
  }
);



let source;
async function getSpeechElevenLabs(text) {

  const start = Date.now();
  (async () => {
    await chrome.runtime.sendMessage({action: true});
    // do something with response here, not outside the function
  })();

  let EL_API_KEY = 'API_KEY_HERE';

  const options = {
    method: 'POST',
    headers: {
      'xi-api-key': EL_API_KEY, 
      'Content-Type': 'application/json'
    },
    body: `{"text":"${text}", "model_id":"eleven_turbo_v2", "stability":50}`
  };

  const voices = {
    old_british_man: "fjUEyxiEBGhIdIzLmVus",
    lily: "pFZP5JQG7iQjIQuC4Bku",
    myOwnVoice: "iCFUKc3rB6sfwKZLdamJ",
  }

  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices.myOwnVoice}/stream?optimize_streaming_latency=3`, options)
    .then(response => response.arrayBuffer())
    .then(data => { 
      // do something with response here, not outside the function
      // Play the audio using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.decodeAudioData(data, buffer => {
        source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

          // Listen for the 'ended' event
        source.addEventListener('ended', () => {
          // You can perform additional actions or cleanup here
        chrome.runtime.sendMessage({action: false});
        // do something with response here, not outside the function
        });

        source.start();
      });

    const end = Date.now();
    console.log(`Execution time: ${end - start} ms`);
    })
    .catch(error => {
      console.error('Error fetching and storing data:', error);
    });


}

// async function getSpeechOpenAI(text) {
//   try {

//     const apiUrl = 'https://api.openai.com/v1/audio/speech';

//     const requestData = {
//       model: 'tts-1',
//       input: text,
//       voice: 'nova',
//     };

//     // Fetch audio data
//     const response = await fetch(apiUrl, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${openaiApiKey}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(requestData),
//     });

//     console.log("fetch finished")
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }

//     const start = Date.now();

//     const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mp3' });
//     const audioUrl = URL.createObjectURL(audioBlob);

//     const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//     const audioElement = new Audio();
//     audioElement.src = audioUrl;

//     const source = audioContext.createMediaElementSource(audioElement);
//     source.connect(audioContext.destination);

//     audioElement.addEventListener('ended', () => {
//       URL.revokeObjectURL(audioUrl);
//       console.log('API call successful. Audio played.');
//     });

//     audioElement.play();
    
//     const end = Date.now();
//     console.log(`Execution time: ${end - start} ms`);
    

//     console.log('API call successful. Audio played.');
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }