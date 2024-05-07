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
        if (items.user === undefined){
            console.log("User underfined");
            document.body.innerHTML = '';
            const signIn = document.createElement('div');
            signIn.style.width = "300px";
            signIn.style.height = "400px";
            signIn.style.display = "flex";
            signIn.style.alignItems= "center";
            signIn.style.justifyContent= "center";
            signIn.style.flexDirection = "column";
            signIn.style.position = "fixed";
            signIn.style.zIndex = "99999";

            const heading = document.createElement('h1');
            heading.textContent = 'Sign in.';
            heading.style.fontSize = '28px';

            const para = document.createElement('p');
            para.textContent = 'Sign into a Google account to use Readel.';
            para.style.fontSize = '15px';
            para.style.textAlign = 'center';

            const signInButton = document.createElement('button');
            signInButton.textContent = 'Sign in';
            signInButton.style.border = 'none';
            signInButton.style.width = '100px';
            signInButton.style.height = '40px';
            signInButton.style.marginTop = '10px';
            signInButton.style.borderRadius = '999px';
            signInButton.style.backgroundColor = '#FFF407';
            signInButton.style.cursor = 'pointer';

            const help = document.createElement('p');
            help.textContent = '* a popup will show. *';
            help.style.fontSize = '10px';
            help.style.margin = '15px';

            signInButton.addEventListener('click', async function(){
                await chrome.runtime.sendMessage({action: 'authUserPopup' })
            })
            signIn.appendChild(heading);
            signIn.appendChild(para);
            signIn.appendChild(signInButton);
            signIn.appendChild(help);
            document.body.appendChild(signIn);
            return;
        }
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }

        getCharacters(items.user);
        })
    return;
}

async function getCharacters(userInfo){
    // console.log(userInfo);
    let setCharacters = document.getElementById('characters');
    let pending = document.createElement('span');
    pending.textContent = "Pending...";
    setCharacters.appendChild(pending);

    const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/default/getCharacters?user=${userInfo}`;
    const responseChar = await fetch(url);
    const dataChar = await responseChar.json();
    const READING_TIME = getCharacterEstimation(dataChar.MAX_CHARACTERS, dataChar.characters);
    let overLimit = false;

    setCharacters = document.getElementById('characters');
    characters = document.createElement('span');
    characters.style.fontSize = "12px";
    // console.log(typeof dataChar.MAX_CHARACTERS)
    // console.log(typeof dataChar.characters)
    // if (Number(dataChar.characters) > Number(dataChar.MAX_CHARACTERS)){
    //     overLimit = true;
    //     console.log("over limit");
    // }else {
    //     console.log("not over limit");
    //     overLimit = false;
    // }

    // characters.textContent = `${dataChar.characters}/${dataChar.MAX_CHARACTERS} (~${Math.round(READING_TIME)} mins)`;
    characters.innerHTML = `<p><span class=${overLimit ? 'redText' : 'greenText'}>${dataChar.characters}</span/>/${dataChar.MAX_CHARACTERS}</p>`
    characters.style.display = 'flex';
    characters.style.alignItems = 'center';
    characters.style.justifyContent = 'center';
    pending.remove();
    setCharacters.appendChild(characters);
}

async function setEmail(){
    await chrome.storage.sync.get('email', async function(items) {
        console.log("GET USER", items.email);
        let emailSeciton = document.getElementById('user-email');
        let text = document.createElement('p');
        if (items.email === undefined){
            text.textContent = "Can't find email...";
        }else {
            text.textContent = `Logged in as: ${items.email}`; 
        }

        emailSeciton.appendChild(text);
    })
}

document.addEventListener('DOMContentLoaded', () => {
    setEmail();
    updateHealthIcon();
    getUser();

    document.addEventListener('click', e => {
        const isDropdownButton = e.target.matches("[data-dropdown-button]");

        if (!isDropdownButton && e.target.closest('[data-dropdown]') != null) return;

        let currentDropdown;
        if (isDropdownButton){
            currentDropdown = e.target.closest('[data-dropdown]');
            currentDropdown.classList.toggle('active');
        }

        document.querySelectorAll("[data-dropdown].active").forEach(dropDown => {
            if (dropDown === currentDropdown) return
            dropDown.classList.remove('active');
        })

    })

    const dropdownContent = document.getElementById('content-voice');
    const dropdownContentQuality = document.getElementById('content-quality');

    // Read it using the storage API
    const defaultButtonVoice = document.getElementById('select-voice');
    chrome.storage.local.get('defaultVoice', function(items) {
        if (items.defaultVoice === undefined){
            console.log('No defualt voice set');
            defaultButtonVoice.textContent = 'Robert';
            return;
        }else {
            defaultButtonVoice.textContent = items.defaultVoice;
        }
    });

    dropdownContent.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default anchor action globally for all clicks within the dropdown
        
        let targetElement = event.target;
        
        // Ensure we always work with the <a> element, even if a child was clicked
        while (targetElement != null && targetElement.tagName !== 'A' && targetElement !== dropdownContent) {
            targetElement = targetElement.parentNode;
        }
        
        // Proceed only if an <a> element was indeed clicked
        if (targetElement && targetElement.tagName === 'A') {
            // Determine the voice name. If the <a> contains a <p>, use its textContent
            const voiceName = targetElement.querySelector('p') ? targetElement.querySelector('p').textContent : targetElement.textContent;
            
            const selectedVoiceId = targetElement.getAttribute('data-id');
            
            // Update button text and save settings
            defaultButtonVoice.textContent = voiceName;
            // console.log(voiceName);
            chrome.storage.local.set({'defaultVoice': voiceName, 'voiceID': selectedVoiceId}, function() {
                console.log('Settings saved', voiceName);
            });
        }
    });

    const defualtButtonSelect = document.getElementById('select-quality');
    chrome.storage.local.get('quality', function(items) {
        if (items.quality === undefined){
            console.log('No default voice set');
            defualtButtonSelect.textContent = 'High';
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