import { PitchShifter } from 'soundtouchjs';

class AudioPlayer {
    constructor() {
        this.init();
    }

    async init() {
        console.log('Audio context is initialized');
        this.bufferQueue = [];
        this.currentBufferIndex = 0;
        this.currentDuration = 0;
        this.currentSentence = "";
        this.bufferElapsedTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioCtx.createGain();
        this.shifter = null;
        this.tempo = 1;
        this.pitch = 1;
        this.playOnAudioEndTimeout = 0;
        this.preFetchTimeout = 0;
        this.resumeTimeout = 0;
        this.skipped = false;
        const res = await this.getPlaybackAndVolume();
        this.tempo = res.playbackRate;
        this.volumeValue = res.volumeValue;
        console.log(this.volumeValue, this.tempo);
        this.gainNode.gain.value = parseFloat(this.volumeValue);
    }

    async startPlaybackCycle(sentences) {
        this.setLoadingCursor(true);

        const user = await this.getUser();
        if (!user) {
            alert("Please sign in to use Readel.");
            this.setLoadingCursor(false);
            return;
        }else {
            this.sentences = sentences;
            this.currentSentenceIndex = 0;
            this.preloadAudio(this.sentences[this.currentSentenceIndex]);
            this.currentSentenceIndex++;
            this.setLoadingCursor(false);

        }
    }

    async preloadAudio(sentence) {
        this.currentSentence = sentence;
        const { voice, quality } = await this.fetchVoiceAndQualitySettings();
        const audioUrl = `https://x6oh96vkd8.execute-api.eu-central-1.amazonaws.com/fetchAudioAPI/fetchAudio?sentence=${encodeURIComponent(sentence)}&index=${this.currentBufferIndex}&voice=${voice}&quality=${quality}`;
        await this.fetchAndDecodeAudio(audioUrl);
    }
    async fetchAndDecodeAudio(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            const data = await res.json();
            if (!data.audioBase64) {
                throw new Error('No audio data found in the response');
            }
            const arrayBufferData = this.base64ToArrayBuffer(data.audioBase64);
            console.log("Array buffer fetched: ", arrayBufferData)
            this.audioCtx.decodeAudioData(arrayBufferData, (buffer) => {
                this.bufferQueue.push(buffer);
                if (!this.isPlaying && !this.isPaused) {
                    this.play();
                }
            });
        } catch (error) {
            console.error('Failed to fetch or decode audio:', error);
            throw error;
        }
    }

    async play() {
        if (this.isPaused) return;

        if (this.bufferQueue.length > 0 && !this.isPaused) {
            console.log("Sentence loaded: ", this.currentSentence);
            const buffer = this.bufferQueue.shift();
            this.shifter = new PitchShifter(this.audioCtx, buffer, 16384);
            this.shifter.tempo = this.tempo;
            this.shifter.pitch = this.pitch;
            this.currentDuration = buffer.duration;
            this.isPlaying = true;
            this.isPaused = false;

            this.preFetchTimeout = setTimeout(() => {
                console.log("audio next audio buffer loaded");
                if (!this.isPaused) { // Check pause state before preloading more audio
                    this.preloadAudio(this.sentences[this.currentSentenceIndex]);
                    if (this.currentSentenceIndex < this.sentences.length - 1) {
                        this.currentSentenceIndex++;
                    } else {
                        console.log('Reached the end of sentences');
                    }
                } else {
                    console.log("Audio is paused.");
                }
            }, buffer.duration * 800 / this.tempo); // Corrected to milliseconds

            const offset = 100;     // 100 miliseconds offset.
            this.playOnAudioEndTimeout = setTimeout(async () => {
                if (!this.isPaused) {
                    console.log("PLAYING NEW AUDIO");
                    this.isPlaying = false;
                    this.decideNextStep();
                }
            }, buffer.duration * 1000 / this.tempo + offset);

            this.setCharacter(this.currentSentence.length).catch(error => {
                console.error("Failed to set character:", error);
            });
            this.shifter.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            console.log("resuming the audio");
            this.audioCtx.resume();
        } else {
            console.log('Queue is empty, waiting for more audio');
        }
    }

    setPlaybackRate(playbackRate) {
        this.playbackRate = playbackRate;
        if (this.shifter) {
            this.shifter.tempo = this.playbackRate;
        }
        this.tempo = this.playbackRate;
        console.log("Playback rate set to ", this.playbackRate);
    }

    decideNextStep() {
        if (!this.isPaused && this.bufferQueue.length > 0) {
            this.play();
        } else {
            this.handleAudioEnded();
        }
    }

    pause() {
        this.audioCtx.suspend();
        this.bufferElapsedTime = this.currentDuration - this.shifter.timePlayed;
        this.isPaused = true;
        this.isPlaying = false;
        clearTimeout(this.playOnAudioEndTimeout);
        clearTimeout(this.preFetchTimeout);
        clearTimeout(this.resumeTimeout);
    }

    resume() {
        if (!this.isPlaying && this.isPaused) {
            this.audioCtx.resume();
            this.isPaused = false;
            this.isPlaying = true;
            this.resumeTimeout = setTimeout(() => {
                if (!this.isPaused) {
                    console.log("PLAYING NEW AUDIO FROM RESUME");
                    this.isPlaying = false;
                    this.decideNextStep();
                }
            }, this.bufferElapsedTime * 1000);
        }
    }

    reset() {
        this.pause();
        this.audioCtx.suspend();
        this.init();
        clearTimeout(this.playOnAudioEndTimeout);
        clearTimeout(this.preFetchTimeout);
        clearTimeout(this.resumeTimeout);
    }

    setVolume(volumeValue) {
        this.volumeValue = volumeValue;
        this.gainNode.gain.value = this.volumeValue;
    }

    skipForward() {
        if (this.currentSentenceIndex < this.sentences.length) {
            this.stop(); // Stop current playback and clear timeouts
            this.preloadAudio(this.sentences[this.currentSentenceIndex]); // Preload next sentence
            this.currentSentenceIndex++;
        } else {
            console.log('Reached the end of the playlist');
        }
    }
    
    skipBackward() {
        if (this.currentSentenceIndex > 0) {
            this.stop(); // Stop current playback and clear timeouts
            this.currentSentenceIndex--; // Move to the previous sentence
            this.preloadAudio(this.sentences[this.currentSentenceIndex]); // Preload previous sentence
        } else {

            console.log('Already at the beginning of the playlist');
        }
    }
    stop(){
        if (this.shifter) {
            this.shifter.disconnect(); // Disconnect the current shifter from the gainNode
        }
        this.audioCtx.suspend();
        this.isPlaying = false;
        this.isPaused = false;
        clearTimeout(this.playOnAudioEndTimeout);
        clearTimeout(this.preFetchTimeout);
        clearTimeout(this.resumeTimeout);
    }

    handleAudioEnded() {
        console.log('Audio ended or skipped, checking for more...');
        if (this.bufferQueue.length > 0) {
            this.play();
        } else if (this.currentSentenceIndex < this.sentences.length) {
            this.preloadAudio(this.sentences[this.currentSentenceIndex]);
            this.currentSentenceIndex++;
        } else {
            console.log('All audio has been played or is at the end of the queue');
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
            })
        });
    }

    base64ToArrayBuffer(base64) {
        var binaryString = window.atob(base64);
        var len = binaryString.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
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

    async setCharacter(length) {
        chrome.storage.sync.get("user", async function (result) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }
            if (result.user === undefined) {
                return;
            }
    
            console.log(result.user);
            const url = `https://82p6i611i7.execute-api.eu-central-1.amazonaws.com/dev/setCharacters?user=${result.user}&updateChar=${length}`;
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${result}`,
                    },
                });
                const data = await response.json();  // Properly await the JSON parsing
                console.log(data);  // Now logging the actual data object
            } catch (error) {
                console.error("Error fetching user info:", error);
            }
        });
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
          });
          resolve({ return: true });
        });
      }
    
}

export default AudioPlayer;
