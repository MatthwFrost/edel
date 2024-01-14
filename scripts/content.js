chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.greeting === "clicked"){
      console.log("Clicked detected");
      var selectedText = window.getSelection().toString().trim();
      if (selectedText !== '') {
        if(selectedText.length > 1000){
          alert("Please select less than 1000 characters")
        }else{
          getSpeech(selectedText);
        }
      }
    }  }
);

async function getSpeech(text) {
  try {
    const openaiApiKey = 'OPENAI_API_KEY';

    const apiUrl = 'https://api.openai.com/v1/audio/speech';

    const requestData = {
      model: 'tts-1',
      input: text,
      voice: 'nova',
    };

    // Fetch audio data
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    console.log("fetch finished")
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const start = Date.now();

    const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioElement = new Audio();
    audioElement.src = audioUrl;

    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(audioContext.destination);

    audioElement.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
      console.log('API call successful. Audio played.');
    });

    audioElement.play();
    
    const end = Date.now();
    console.log(`Execution time: ${end - start} ms`);
    

    console.log('API call successful. Audio played.');
  } catch (error) {
    console.error('Error:', error);
  }
}