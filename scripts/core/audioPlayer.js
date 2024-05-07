import { Howl } from 'howler';

class AudioPlayer {
    constructor() {
        this.init();
    }

    async init() {
        this.howler = null;
        this.sentences = [];
        this.sentenceIndex = 0;
        this.isPaused = false;
        this.isPlaying = false;
        this.durationCurrent = 0;
        this.bufferQueue = [];
        this.preFetchTimer = 0;
        this.user = null; 
        const settings = await this.getPlaybackAndVolume();
        this.volume = settings.volumeValue;
        this.rate = settings.playbackRate;
    }

    async startPlaybackCycle(sentences) {
        this.setLoadingCursor(true);
        this.sentences = sentences;
        this.user = await this.getUser();


        if (!this.user) {
            alert("Please sign in to use Readel.");
            this.setLoadingCursor(false);
            return;
        }else {        
            this.loadNextAudio();
            this.setLoadingCursor(false);
        }
    }

    async loadNextAudio() {
        if (this.sentenceIndex < this.sentences.length) {
            const sentence = this.sentences[this.sentenceIndex];
            const res = await this.getCharacters(this.user.return);
            const characters = parseInt(res.characters);
            const max_characters = parseInt(res.MAX_CHARACTERS);

            if(characters + sentence.length >= max_characters){
                alert("You have used all of your characters. Audio will stop playing after this sentence. Characters reset daily or you can raise your daily limit. Find more here: https://www.readel.app/buycredits.");
                this.reset();
                return;
            }

            const audioData = await this.fetchAudioData(sentence);
            const audioUrl = this.base64ToBlobUrl(audioData.audioBase64, 'audio/mp3');
            this.bufferQueue.push(audioUrl);
            if (!this.isPlaying && !this.isPaused) {
                this.createHowlerInstance();
            }
        }
    }

    async fetchAudioData(sentence) {
        const { voice, quality } = await this.fetchVoiceAndQualitySettings();
        const apiUrl = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${encodeURIComponent(sentence)}&index=${this.sentenceIndex}&voice=${voice}&quality=${quality}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    }

    createHowlerInstance() {
        if (this.bufferQueue.length > 0 && !this.isPaused) {
            const audioUrl = this.bufferQueue.shift();
            this.isPlaying = true;

            this.howler = new Howl({
                src: [audioUrl],
                format: ['mp3'],
                html5: true,
                volume: this.volume,
                rate: this.rate,
                onload: () => {
                    this.durationCurrent = this.howler.duration();
                    // console.log("Audio loaded with duration:", this.durationCurrent, "seconds");
                },
                onplay: () => {
                    // console.log("Audio playing");
                    this.setCharacter(this.sentences[this.sentenceIndex].length).catch(error => {
                        console.error("Failed to set character:", error);
                    });
                    
                    this.preFetchTimer = setTimeout(() => {
                        if (!this.isPaused){
                            // console.log("Prefetching audio");
                            // console.log("Sentence being fetched: ", this.sentences[this.sentenceIndex]);
                            this.sentenceIndex++;
                            this.loadNextAudio();
                        }
                    }, this.durationCurrent * 800 / this.rate);
                },
                onend: () => {
                    // console.log("Audio ended");
                    this.handleAudioEnd();
                }
            });
            this.howler.play();
        }
    }

    handleAudioEnd() {
        this.isPlaying = false;
        if (this.bufferQueue.length > 0){
            this.createHowlerInstance();
        }
        else if (this.sentenceIndex < this.sentences.length - 1) {
            this.sentenceIndex++
            this.loadNextAudio(); // Load the next audio after the current one finishes
        }
    }

    setVolume(volumeLevel) {
        this.volume = volumeLevel;
        if (this.howler) {
            this.howler.volume(volumeLevel);
        }
    }

    setPlaybackRate(rate) {
        this.rate = rate;
        if (this.howler) {
            this.howler.rate(rate);
        }
    }

    pause() {
        if (this.howler) {
            this.isPaused = true;
            this.isPlaying = false;
            this.howler.pause();
            clearTimeout(this.preFetchTimer);
        }
    }

    resume() {
        if (this.howler && this.isPaused) {
            this.isPaused = false;
            this.isPlaying = true;
            this.howler.play();
        }
    }

    reset(){
        if (this.howler){
            this.howler.pause();
        }
        this.init();
        clearTimeout(this.preFetchTimer);
    }

    skipForward() {
        if (this.sentenceIndex < this.sentences.length - 1) {
            this.isPlaying = false;
            this.howler.pause();
            if (this.bufferQueue.length > 0){
                this.createHowlerInstance();
            }else {
                this.sentenceIndex++;
                this.loadNextAudio();
            }
        }
    }

    skipBackward() {
        if (this.sentenceIndex > 0) {
            if (this.bufferQueue.length > 0) {
                this.bufferQueue = [];
            }

            this.isPlaying = false;
            this.howler.pause();
            this.sentenceIndex--;
            this.loadNextAudio();
        }
    }

    async fetchVoiceAndQualitySettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(["voiceID", "qualityID"], (items) => {
                const voice = items.voiceID || "robert";
                const quality = items.qualityID || "high";
                resolve({ voice, quality });
            });
        });
    }

    async getPlaybackAndVolume() {
        return new Promise((resolve) => {
            chrome.storage.local.get(["volumeValue", "playbackRate"], (items) => {
                const volumeValue = items.volumeValue || 0.5;
                const playbackRate = items.playbackRate || 1;
                resolve({ volumeValue, playbackRate });
            });
        });
    }    

    base64ToBlobUrl(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: mimeType});
        return URL.createObjectURL(blob);
    }

    async setCharacter(length) {
        chrome.storage.sync.get("user", async function (result) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            if (result.user === undefined) {
                return;
            }
    
            // console.log(result.user);
            const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setCharacters?user=${result.user}&updateChar=${length}`;
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${result}`,
                    },
                });
                const data = await response.json();  // Properly await the JSON parsing
                // console.log(data);  // Now logging the actual data object
            } catch (error) {
                console.error("Error fetching user info:", error);
            }
        });
    }

    async getCharacters(user){
        // console.log(result.user);
        const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/default/getCharacters?user=${user}`;
        const responseChar = await fetch(url);
        const data = await responseChar.json();
        return data;
    }

    async getUser() {
        return new Promise((resolve) => {
          chrome.storage.sync.get("user", async function (items) {
            if (items.user === undefined) {
              alert(
                "Oh no, you are not signed in! Click on 'Readel' in the Extensions tab to sign in."
              );
              resolve({ return: false });
            }
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              resolve({ return: false });
            }
            resolve({ return: items.user});
          });
        });
    }

    setLoadingCursor(isLoading) {
        if (isLoading) {
            const style = document.createElement("style");
            style.id = "corsor_wait";
            style.innerHTML = "* {cursor: wait;}";
            document.head.insertBefore(style, null);
        } else {
            document.getElementById("corsor_wait").remove();
        }
    }
}

export default AudioPlayer;
