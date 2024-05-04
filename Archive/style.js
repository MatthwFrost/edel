export default class UI {
    buildVolumeButton() {
    const settingsVolumeButton = document.createElement("button");
    settingsVolumeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 640 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M533.6 32.5C598.5 85.2 640 165.8 640 256s-41.5 170.7-106.4 223.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C557.5 398.2 592 331.2 592 256s-34.5-142.2-88.7-186.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM473.1 107c43.2 35.2 70.9 88.9 70.9 149s-27.7 113.8-70.9 149c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C475.3 341.3 496 301.1 496 256s-20.7-85.3-53.2-111.8c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zm-60.5 74.5C434.1 199.1 448 225.9 448 256s-13.9 56.9-35.4 74.5c-10.3 8.4-25.4 6.8-33.8-3.5s-6.8-25.4 3.5-33.8C393.1 284.4 400 271 400 256s-6.9-28.4-17.7-37.3c-10.3-8.4-11.8-23.5-3.5-33.8s23.5-11.8 33.8-3.5zM301.1 34.8C312.6 40 320 51.4 320 64V448c0 12.6-7.4 24-18.9 29.2s-25 3.1-34.4-5.3L131.8 352H64c-35.3 0-64-28.7-64-64V224c0-35.3 28.7-64 64-64h67.8L266.7 40.1c9.4-8.4 22.9-10.4 34.4-5.3z"/></svg>`;
    settingsVolumeButton.setAttribute('class', 'settingVolumeButton')
    return settingsVolumeButton;
    }

    buildPlaybackButton() {
    const settingsPlaybackControllButton = document.createElement("button");
    settingsPlaybackControllButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path fill="#ffffff" d="M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm320 96c0-26.9-16.5-49.9-40-59.3V88c0-13.3-10.7-24-24-24s-24 10.7-24 24V292.7c-23.5 9.5-40 32.5-40 59.3c0 35.3 28.7 64 64 64s64-28.7 64-64zM144 176a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm-16 80a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm288 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM400 144a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>`;
    settingsPlaybackControllButton.style.backgroundColor = "transparent";
    settingsPlaybackControllButton.style.zIndex = "999";
    settingsPlaybackControllButton.style.marginLeft = "5px";
    settingsPlaybackControllButton.style.display = "flex";
    settingsPlaybackControllButton.style.alignItems = "center";
    settingsPlaybackControllButton.style.border = "none";
    settingsPlaybackControllButton.style.cursor = "pointer";
    return settingsPlaybackControllButton;
    }

    buildSettingsContainer() {
    const settingsContainer = document.createElement("div");
    settingsContainer.style.display = "flex";
    settingsContainer.style.width = "0"; // Start with minimal width
    settingsContainer.style.overflow = "hidden"; // Prevent content overflow during animation
    settingsContainer.style.visibility = "hidden"; // Initially not visible but occupies space for smooth transition
    settingsContainer.style.transition = "width 0.4s ease, opacity 0.5s ease"; // Transition for width and opacity
    settingsContainer.style.height = "40px";
    settingsContainer.style.borderRadius = "30px 1px 1px 30px"; // Rounded edges
    settingsContainer.style.backgroundColor = "black";
    settingsContainer.style.flexDirection = "row";
    settingsContainer.style.alignItems = "center";
    settingsContainer.style.justifyContent = "center";
    return settingsContainer;
    }

    buildSettingsToggleContainer() {
    const toggleSettingsContainer = document.createElement("div");
    toggleSettingsContainer.style.position = "fixed";
    toggleSettingsContainer.style.display = "flex"; // Ensure it's ready to layout its children
    toggleSettingsContainer.style.visibility = "visible"; // Make sure it's not hiding its children
    toggleSettingsContainer.style.bottom = `${screen.height / 2 - 20}px`;
    toggleSettingsContainer.style.right = "50px";
    toggleSettingsContainer.style.alignItems = "center";
    return toggleSettingsContainer;
    }

    buildSettingsVolumeSlider() {
    const settingsVolumeSlider = document.createElement("input");
    settingsVolumeSlider.setAttribute("id", "volume-id");
    settingsVolumeSlider.style.position = "fixed";
    settingsVolumeSlider.style.display = "none";
    settingsVolumeSlider.style.bottom = `${screen.height / 2 + 25}px`;
    settingsVolumeSlider.style.right = "65px";
    settingsVolumeSlider.type = "range";
    settingsVolumeSlider.style.height = "0px";
    settingsVolumeSlider.style.transition = "width 0.2s ease, opacity 0.4s ease"; // Transition for width and opacity
    settingsVolumeSlider.style.opacity = "0"; // Transition for width and opacity
    settingsVolumeSlider.style.writingMode = "vertical-lr";
    settingsVolumeSlider.min = 0;
    settingsVolumeSlider.max = 100;
    settingsVolumeSlider.step = "0.25";
    settingsVolumeSlider.value = "50";
    settingsVolumeSlider.style.webkitAppearance = "none";
    settingsVolumeSlider.style.width = "20px";
    settingsVolumeSlider.style.height = "100px";
    settingsVolumeSlider.style.borderRadius = "5px";
    settingsVolumeSlider.style.background = "#d3d3d3";
    settingsVolumeSlider.style.outline = "none";
    settingsVolumeSlider.style.transition = "opacity .2s";
    return settingsVolumeSlider;
    }

    buildSettingsPlaybackControllSlider() {
    const pitchControlSlider = document.createElement("input");
    pitchControlSlider.setAttribute("id", "pitch-id");
    pitchControlSlider.style.position = "fixed";
    pitchControlSlider.style.display = "visible";
    pitchControlSlider.style.bottom = "0px";
    pitchControlSlider.style.right = "0px";
    pitchControlSlider.type = "range";
    pitchControlSlider.style.height = "100px"; // Keep the slider vertical
    pitchControlSlider.style.width = "20px"; // Width of the slider
    pitchControlSlider.style.writingMode = "vertical-lr";
    pitchControlSlider.style.webkitAppearance = "none";
    pitchControlSlider.style.borderRadius = "5px";
    pitchControlSlider.style.background = "#d3d3d3";
    pitchControlSlider.style.outline = "none";
    pitchControlSlider.style.transition = "opacity .2s";
    pitchControlSlider.min = 0.5; // Representing 50%
    pitchControlSlider.max = 2; // Representing 200%
    pitchControlSlider.step = "0.25"; // Step by 10% for pitch adjustment
    pitchControlSlider.value = "1"; // Normal pitch
    return pitchControlSlider;
    }

    buildAudioController() {
    const audioController = document.createElement("div");
    audioController.style.width = "45px";
    audioController.style.height = "40px";
    audioController.style.backgroundColor = "#084b83";
    audioController.style.opacity = "0.6";
    audioController.style.borderRadius = "30px 0px 0px 30px"; // Rounded edges
    audioController.style.boxShadow = "0 4px 30px rgba(0, 0, 0, 0.1)";
    audioController.style.backdropFilter = "blur(9.8px)";
    audioController.style.webkitBackdropFilter = "blur(9.8px)";
    audioController.style.transition = "width 0.5s ease, opacity 0.5s ease"; // Smooth transition for width
    audioController.style.border = "1px black";
    audioController.style.overflowX = "hidden";
    audioController.style.whiteSpace = "nowrap";
    audioController.style.display = "inline-block";
    audioController.style.fontSize = "20px";
    audioController.style.cursor = "pointer";
    return audioController;
    }

    buildAudioControllerButtonContainer() {
    const audioControllerButtonContainer = document.createElement("div");
    audioControllerButtonContainer.style.width = "100%";
    audioControllerButtonContainer.style.height = "100%";
    audioControllerButtonContainer.style.display = "flex";
    audioControllerButtonContainer.style.alignItems = "center";
    audioControllerButtonContainer.style.justifyContent = "center";
    return audioControllerButtonContainer;
    }

    buildAudioControllerPlayButton() {
    const audioControllerPlayButton = document.createElement("button");
    audioControllerPlayButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="#fff" height="16" width="16" viewBox="0 0 384 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>`;
    audioControllerPlayButton.style.display = "flex";
    audioControllerPlayButton.style.alignItems = "center";
    audioControllerPlayButton.style.justifyContent = "center";
    audioControllerPlayButton.style.background = "none";
    audioControllerPlayButton.style.backgroundColor = "none";
    audioControllerPlayButton.style.border = "none";
    audioControllerPlayButton.style.cursor = "pointer";
    return audioControllerPlayButton;
    }

    buildAudioControllerSkipBackwardButton() {
    const audioControllerSkipBackwardButton = document.createElement("button");
    audioControllerSkipBackwardButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-skip-back"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>`;
    audioControllerSkipBackwardButton.style.visibility = "hidden";
    audioControllerSkipBackwardButton.style.display = "flex";
    audioControllerSkipBackwardButton.style.alignItems = "center";
    audioControllerSkipBackwardButton.style.justifyContent = "center";
    audioControllerSkipBackwardButton.style.background = "none";
    audioControllerSkipBackwardButton.style.backgroundColor = "none";
    audioControllerSkipBackwardButton.style.border = "none";
    audioControllerSkipBackwardButton.style.cursor = "pointer";
    return audioControllerSkipBackwardButton;
    }

    buildAudioControllerSkipForwardButton() {
    const audioControllerSkipForwardButton = document.createElement("button");
    audioControllerSkipForwardButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
    audioControllerSkipForwardButton.style.display = "flex";
    audioControllerSkipForwardButton.style.visibility = "hidden";
    audioControllerSkipForwardButton.style.alignItems = "center";
    audioControllerSkipForwardButton.style.justifyContent = "center";
    audioControllerSkipForwardButton.style.background = "none";
    audioControllerSkipForwardButton.style.backgroundColor = "none";
    audioControllerSkipForwardButton.style.border = "none";
    audioControllerSkipForwardButton.style.cursor = "pointer";
    return audioControllerSkipForwardButton;
    }

    buildAudioContainer() {
    const audioContainer = document.createElement("div");
    audioContainer.style.position = "fixed";
    audioContainer.style.bottom = screen.height / 2 + "px";
    audioContainer.style.right = "0px";
    audioContainer.style.height = "20px";
    audioContainer.style.zIndex = "10000";
    audioContainer.className = "readel-audio-player";
    return audioContainer;
    }
}