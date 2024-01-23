let offset = 0;
let audioData = [];
let source;

function onButtonClick(i) {

    if (source) { 
        source.stop();
    }

    const audio = base64ToArrayBuffer(audioData[i]);
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContext.decodeAudioData(audio, buffer => {

        source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        // Change speed of audio, however, pitch changes which I don't like.
        // source.playbackRate.value = 1.5;

        // Check if the audio is ended.
        source.addEventListener('ended', () => {
        });

        source.start();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Your code here
    getRecentAudio();
    addLoadMoreButton();
});

async function getRecentAudio() {
    const user = "Matt";
    const limit = 5;
    console.log(`Before send off: ${offset}`);
    const url = `https://69hw2yk5p9.execute-api.eu-central-1.amazonaws.com/dev/?userID=${user}&limit=${limit}&offset=${offset}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        });

        const data = await response.json();
        const MAX_LENGTH = data.MAX_LENGTH;
        for (let i = 0; i < data.data.data.length; i++) {
            await audioData.push(data.data.data[i]['audio-data']);
            let container = document.body;
            const text = data.data.data[i].text;
            const cappedText = `${text.substring(0, 30)}...`;

            createCustomComponent(container, 'Play', cappedText, text, i);
        }
        // Check if we have reached the end of the database. If we haven't, add show more button.

        const loading = document.getElementById('load');
        if (loading) {
            loading.remove();
        }
        if (offset + limit >= MAX_LENGTH) {
            const loadMoreButton = document.getElementById('load-more');
            loadMoreButton.remove();
            return;
        } else{
            const loadMoreButton = document.getElementById('load-more');
            loadMoreButton.remove();
            addLoadMoreButton(MAX_LENGTH, offset, limit);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }

    offset += limit;
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

function addLoadMoreButton(MAX_LENGTH, offset, limit) { 
    const fetchMoreButton = document.createElement('button');
    fetchMoreButton.className = 'load-more';
    fetchMoreButton.id = 'load-more';
    if (!MAX_LENGTH && !offset && !limit){
        fetchMoreButton.textContent = `Show more`;
    }else{
        fetchMoreButton.textContent = `Show more (${MAX_LENGTH - (offset + limit)} left)`;
    }
    document.body.appendChild(fetchMoreButton);

    fetchMoreButton.addEventListener('click', () => {
        fetchMoreButton.innerHTML = '<img src="/assets/loading.gif" alt="Loading..." style="width: 20px; height: 20px; margin-right: 5px;" /> Searching';
        getRecentAudio();
    });
};



function createCustomComponent(parentElement, buttonText, headingText, infoText, i) {
    // Create main div for the component
    var componentDiv = document.createElement('div');
    componentDiv.className = 'audio-component';

    // Create button
    var button = document.createElement('button');
    button.className = 'AudioButton';
    button.textContent = buttonText;

    button.addEventListener('click', () => {
        onButtonClick(i);
    });

    // Create heading
    var heading = document.createElement('h2');
    heading.className = 'component-heading';
    heading.textContent = headingText;

    // Create information paragraph
    var infoParagraph = document.createElement('p');
    infoParagraph.className = 'component-info';
    infoParagraph.textContent = infoText.substring(0, 50) + '...';

    let subComponentDiv = document.createElement('div');
    subComponentDiv.className = 'sub-component';
    subComponentDiv.appendChild(heading);
    subComponentDiv.appendChild(infoParagraph);

    let divider = document.createElement('hr');
    divider.style = 'width:100%;text-align:left;margin-left:0;opacity:0.5;border-radius:999px;';

    // Append elements to the main div
    componentDiv.appendChild(subComponentDiv);
    componentDiv.appendChild(button);

    // Append the component to the parent element
    parentElement.appendChild(componentDiv);
    parentElement.appendChild(divider);
    
}
