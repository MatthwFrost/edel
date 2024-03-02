// Not very good tbh
function updateHealthIcon() {
    const healthIcon = document.getElementById('dot');
    chrome.storage.local.get('error', function(result) {
        const hasErrors = result.error;
        let open;
        let textNode;

        if (hasErrors) {
            healthIcon.classList.remove('green');
            healthIcon.classList.add('red');
            const healthDiv = document.getElementById('health');

            healthDiv.addEventListener('click', function() {
                if (open){
                    open = false;
                    textNode.remove();
                }else {
                    open = true;
                    textNode = document.createElement('div');
                    text = 'There are errors in the extension. Please check the console for more information.';
                    textNode.textContent = text;
                    textNode.style = 'color: red; font-size: 12px; margin: 10px 0 0 10px';

                    healthDiv.parentNode.insertBefore(textNode, healthDiv.nextSibling);

                    // Remove the error from the storage.
                    chrome.storage.local.set({'error': null});
                }
            });
        } else {
            healthIcon.classList.remove('red');
            healthIcon.classList.add('green');
            const healthDiv = document.getElementById('health');

            healthDiv.addEventListener('click', function() {
                if (open){
                    open = false;
                    textNode.remove();
                }else {
                    open = true;
                    textNode = document.createElement('div');
                    text = 'There are no errors to report.';
                    textNode.textContent = text;
                    textNode.style = 'color: seagreen; font-size: 12px; margin: 10px 0 0 10px';

                    healthDiv.parentNode.insertBefore(textNode, healthDiv.nextSibling);
                }
            });


        }
    });
}

// Move this function to 
async function getUser(){
    await chrome.storage.sync.get('user', async function(items) {
        console.log("GET USER",items.user);
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }
        getCharacters(items.user);
        // const profileImageUrl = userInfo.picture;
        
        // let setProfileImage = document.createElement('img');
        // setProfileImage.src = profileImageUrl;
        // setProfileImage.className = 'nav-img';

        // let pDiv = document.getElementById('nav-user-icon');
        // pDiv.appendChild(setProfileImage);

          // Use the profile image URL as needed
        })
    return;
}

async function getCharacters(userInfo){
    console.log(userInfo);
    let setCharacters = document.getElementById('characters');
    let pending = document.createElement('span');
    pending.textContent = "Pending...";
    setCharacters.appendChild(pending);

    const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/getCharacters?user=${userInfo}`;
    const responseChar = await fetch(url);
    const dataChar = await responseChar.json();
    const READING_TIME = getCharacterEstimation(dataChar.MAX_CHARACTERS, dataChar.characters);

    setCharacters = document.getElementById('characters');
    characters = document.createElement('span');
    characters.style.fontSize = "12px";
    characters.textContent = `${dataChar.characters}/${dataChar.MAX_CHARACTERS} (~${Math.round(READING_TIME)} mins)`;
    pending.remove();
    setCharacters.appendChild(characters);
}

document.addEventListener('DOMContentLoaded', () => {
    // Show if there are errors.
    updateHealthIcon();
    getUser();

    const dropdownContent = document.getElementById('content-voice');
    const dropdownContentQuality = document.getElementById('content-quality');

    // Read it using the storage API
    const defualtButtonVoice = document.getElementById('select-voice');
    chrome.storage.local.get('defaultVoice', function(items) {
        if (items.defaultVoice === undefined){
            console.log('No defualt voice set');
            defualtButtonVoice.textContent = 'Robert';
            return;
        }else {
            defualtButtonVoice.textContent = items.defaultVoice;
        }
    });

    dropdownContent.addEventListener('click', function(event) {
        if (event.target.tagName === 'A') {
        // Change the button text to the text of the clicked item
        defualtButtonVoice.textContent = event.target.textContent;
        const selectedVoiceId = event.target.getAttribute('data-id');
        // Prevent default anchor action
        event.preventDefault();
        console.log(event.target.textContent);
        chrome.storage.local.set({'defaultVoice': event.target.textContent, 'voiceID': selectedVoiceId}, function() {
            console.log('Settings saved', event.target.textContent);
        });
        }
    });

    const defualtButtonSelect = document.getElementById('select-quality');
    chrome.storage.local.get('quality', function(items) {
        if (items.quality === undefined){
            console.log('No default voice set');
            defualtButtonSelect.textContent = 'Low (Fastest)';
            return;
        }else {
            defualtButtonSelect.textContent = items.quality;
        }
    });

    dropdownContentQuality.addEventListener('click', function(event) {
        if (event.target.tagName === 'A') {
        // Change the button text to the text of the clicked item
        defualtButtonSelect.textContent = event.target.textContent;
        const selectedQuality = event.target.getAttribute('data-id');
        console.log(selectedQuality);

        // Prevent default anchor action
        event.preventDefault();
        console.log(event.target.textContent);
        chrome.storage.local.set({'quality': event.target.textContent, 'qualityID': selectedQuality}, function() {
            console.log('Settings saved', event.target.textContent);
        });
        }
    });
});

function getCharacterEstimation(totalCharacters, currentCharacters){
    const AVG_CHARACTERS = 5;
    const AVG_WPM = 150;

    const AVG_WORDS = (totalCharacters - currentCharacters) / AVG_CHARACTERS;
    const READING_TIME = AVG_WORDS / AVG_WPM;
    return READING_TIME;
}

// let offset = 0;
// let audioData = [];
// let source;

// function onButtonClick(i) {

//     if (source) { 
//         source.stop();
//     }

//     const audio = base64ToArrayBuffer(audioData[i]);
//     const audioContext = new (window.AudioContext || window.webkitAudioContext)();
//     audioContext.decodeAudioData(audio, buffer => {

//         source = audioContext.createBufferSource();
//         source.buffer = buffer;
//         source.connect(audioContext.destination);

//         // Change speed of audio, however, pitch changes which I don't like.
//         // source.playbackRate.value = 1.5;

//         // Check if the audio is ended.
//         source.addEventListener('ended', () => {
//         });

//         source.start();
//     });
// }

// document.addEventListener('DOMContentLoaded', () => {
//     // Your code here
//     getRecentAudio();
//     addLoadMoreButton();
// });

// async function getRecentAudio() {
//     const user = "Matt";
//     const limit = 5;
//     console.log(`Before send off: ${offset}`);
//     const url = `https://69hw2yk5p9.execute-api.eu-central-1.amazonaws.com/dev/?userID=${user}&limit=${limit}&offset=${offset}`;
//     try {
//         const response = await fetch(url, {
//             method: 'GET',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//         });

//         const data = await response.json();
//         const MAX_LENGTH = data.MAX_LENGTH;
//         for (let i = 0; i < data.data.data.length; i++) {
//             await audioData.push(data.data.data[i]['audio-data']);
//             let container = document.body;
//             const text = data.data.data[i].text;
//             const cappedText = `${text.substring(0, 30)}...`;

//             createCustomComponent(container, 'Play', cappedText, text, i);
//         }
//         // Check if we have reached the end of the database. If we haven't, add show more button.

//         const loading = document.getElementById('load');
//         if (loading) {
//             loading.remove();
//         }
//         if (offset + limit >= MAX_LENGTH) {
//             const loadMoreButton = document.getElementById('load-more');
//             loadMoreButton.remove();
//             return;
//         } else{
//             const loadMoreButton = document.getElementById('load-more');
//             loadMoreButton.remove();
//             addLoadMoreButton(MAX_LENGTH, offset, limit);
//         }
//     } catch (error) {
//         console.error('Error fetching data:', error);
//     }

//     offset += limit;
// }

// function base64ToArrayBuffer(base64) {
//     var binaryString = atob(base64);
//     var bytes = new Uint8Array(binaryString.length);
//     for (var i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//     }
//     console.log(bytes.buffer);
//     return bytes.buffer;
// }

// function addLoadMoreButton(MAX_LENGTH, offset, limit) { 
//     const fetchMoreButton = document.createElement('button');
//     fetchMoreButton.className = 'load-more';
//     fetchMoreButton.id = 'load-more';
//     if (!MAX_LENGTH && !offset && !limit){
//         fetchMoreButton.textContent = `Show more`;
//     }else{
//         fetchMoreButton.textContent = `Show more (${MAX_LENGTH - (offset + limit)} left)`;
//     }
//     document.body.appendChild(fetchMoreButton);

//     fetchMoreButton.addEventListener('click', () => {
//         fetchMoreButton.innerHTML = '<img src="/assets/loading.gif" alt="Loading..." style="width: 20px; height: 20px; margin-right: 5px;" /> Searching';
//         getRecentAudio();
//     });
// };



// function createCustomComponent(parentElement, buttonText, headingText, infoText, i) {
//     // Create main div for the component
//     var componentDiv = document.createElement('div');
//     componentDiv.className = 'audio-component';

//     // Create button
//     var button = document.createElement('button');
//     button.className = 'AudioButton';
//     button.textContent = buttonText;

//     button.addEventListener('click', () => {
//         onButtonClick(i);
//     });

//     // Create heading
//     var heading = document.createElement('h2');
//     heading.className = 'component-heading';
//     heading.textContent = headingText;

//     // Create information paragraph
//     var infoParagraph = document.createElement('p');
//     infoParagraph.className = 'component-info';
//     infoParagraph.textContent = infoText.substring(0, 50) + '...';

//     let subComponentDiv = document.createElement('div');
//     subComponentDiv.className = 'sub-component';
//     subComponentDiv.appendChild(heading);
//     subComponentDiv.appendChild(infoParagraph);

//     let divider = document.createElement('hr');
//     divider.style = 'width:100%;text-align:left;margin-left:0;opacity:0.5;border-radius:999px;';

//     // Append elements to the main div
//     componentDiv.appendChild(subComponentDiv);
//     componentDiv.appendChild(button);

//     // Append the component to the parent element
//     parentElement.appendChild(componentDiv);
//     parentElement.appendChild(divider);
    
// }
