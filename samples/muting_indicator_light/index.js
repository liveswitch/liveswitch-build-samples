document.addEventListener("DOMContentLoaded", () => {
  const userVideo = document.getElementById("userVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const joinButton = document.getElementById("joinButton");
  const leaveButton = document.getElementById("leaveButton");
  const muteMicrophoneButton = document.getElementById("muteMicrophoneButton");
  const muteCameraButton = document.getElementById("muteCameraButton");

  let localAudio;
  let localVideo;

  fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));

  // Function to set up and display local video
  async function startLocalMedia() {
    try {
      localAudio = new fm.liveswitch.LocalMedia(true, false);
      await localAudio.start();
    } catch (error) {
      fm.liveswitch.Log.error("Error starting local audio: " + error);
    }

    try {
      localVideo = new fm.liveswitch.LocalMedia(false, true);
      await localVideo.start();
      userVideo.appendChild(localVideo.getView());
    } catch (error) {
      fm.liveswitch.Log.error("Error starting local video: " + error);
    }
  }

  // Function to join the call
  async function joinCall() {
    joinButton.disabled = true;
    try {
      await startLocalMedia();
      leaveButton.disabled = false;
      muteMicrophoneButton.disabled = false;
      muteCameraButton.disabled = false;
    } catch (_) {
      joinButton.disabled = false;
    }
  }

  // Function to leave the call and stop local media
  function leaveCall() {
    leaveButton.disabled = true;
    muteMicrophoneButton.disabled = true;
    muteCameraButton.disabled = true;
    muteMicrophoneButton.textContent = "Mute Microphone";
    muteCameraButton.textContent = "Mute Camera";

    if (localAudio) {
      localAudio.stop();
    }
    if (localVideo) {
      localVideo.stop();
      userVideo.innerHTML = '';
    }
    joinButton.disabled = false;
  }

  // Function to toggle microphone mute/unmute
  function toggleMicrophone() {
    muteMicrophoneButton.disabled = true;
    if (localAudio.getState() == fm.liveswitch.LocalMediaState.Started) {
      localAudio.stop().then(_ => {
        muteMicrophoneButton.textContent = "Unmute Microphone";
        muteMicrophoneButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error muting local audio.", ex);
        muteMicrophoneButton.textContent = "Mute Microphone";
        muteMicrophoneButton.disabled = false;
      });
    } else {
      localAudio.start().then(_ => {
        muteMicrophoneButton.textContent = "Mute Microphone";
        muteMicrophoneButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error unmuting local audio.", ex);
        muteMicrophoneButton.textContent = "Unmute Microphone";
        muteMicrophoneButton.disabled = false;
      });
    }
  }

  // Function to toggle camera mute/unmute
  function toggleCamera() {
    muteCameraButton.disabled = true;
    if (localVideo.getState() == fm.liveswitch.LocalMediaState.Started) {
      localVideo.stop().then(_ => {
        muteCameraButton.textContent = "Unmute Camera";
        muteCameraButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error muting local video.", ex);
        muteCameraButton.textContent = "Mute Camera";
        muteCameraButton.disabled = false;
      });
    } else {
      localVideo.start().then(_ => {
        muteCameraButton.textContent = "Mute Camera";
        muteCameraButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error unmuting local video.", ex);
        muteCameraButton.textContent = "Unmute Camera";
        muteCameraButton.disabled = false;
      });
    }
  }

  // Event listeners for buttons
  joinButton.addEventListener("click", joinCall);
  leaveButton.addEventListener("click", leaveCall);
  muteMicrophoneButton.addEventListener("click", toggleMicrophone);
  muteCameraButton.addEventListener("click", toggleCamera);
});