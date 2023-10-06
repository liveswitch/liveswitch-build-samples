document.addEventListener("DOMContentLoaded", () => {
  const userVideo = document.getElementById("userVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const joinButton = document.getElementById("joinButton");
  const leaveButton = document.getElementById("leaveButton");
  const muteMicrophoneButton = document.getElementById("muteMicrophoneButton");
  const muteCameraButton = document.getElementById("muteCameraButton");
  const localMicMuteIndicator = document.getElementById("user-mic-mute-indicator");
  const localCameraMuteIndicator = document.getElementById("user-camera-mute-indicator");
  const remoteMicMuteIndicator = document.getElementById("remote-mic-mute-indicator");
  const remoteCameraMuteIndicator = document.getElementById("remote-camera-mute-indicator");

  let localAudio;
  let localVideo;
  let gatewayUrl = "https://v1.liveswitch.fm:8443/sync";
  let applicationId = "my-app-id";
  let sharedSecret = "--replaceThisWithYourOwnSharedSecret--";
  let channelId = (Math.floor(Math.random() * 900000) + 100000).toString();
  let senderClient;
  let receiverClient;
  let senderChannel;
  let receiverChannel;
  let senderUpstreamConnection;

  fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));

  // Function to set up and display local video
  async function startLocalMedia() {
    try {
      localAudio = new fm.liveswitch.LocalMedia(true, false);
      await localAudio.start();
    } catch (error) {
      fm.liveswitch.Log.error("Error starting local audio.", error);
      throw error;
    }

    try {
      localVideo = new fm.liveswitch.LocalMedia(false, true);
      await localVideo.start();
      userVideo.appendChild(localVideo.getView());
    } catch (error) {
      fm.liveswitch.Log.error("Error starting local video.", error);
      throw error;
    }
  }

  // Function for sender to register with LiveSwitch Gateway, join a channel and create upstream connection
  async function senderRegisterAndConnect() {
    let promise = new fm.liveswitch.Promise();
    senderClient = new fm.liveswitch.Client(gatewayUrl, applicationId);
    let channelClaims = [new fm.liveswitch.ChannelClaim(channelId)];
    let token = fm.liveswitch.Token.generateClientRegisterToken(applicationId, senderClient.getUserId(), senderClient.getDeviceId(), senderClient.getId(), null, channelClaims, sharedSecret);
    senderClient.register(token).then(channels => {
      senderChannel = channels[0];
      openSfuUpstreamConnection().then(_ => {
        promise.resolve(null);
      }).catch(ex => {
        promise.reject(ex)
      });
    }).fail(ex => {
      fm.liveswitch.Log.error("Failed to register sender.", ex);
      promise.reject(ex);
    });
    return promise;
  }

  async function openSfuUpstreamConnection() {
    let audioStream = new fm.liveswitch.AudioStream(localAudio);
    let videoStream = new fm.liveswitch.VideoStream(localVideo);
    senderUpstreamConnection = senderChannel.createSfuUpstreamConnection(audioStream, videoStream);
    return senderUpstreamConnection.open().fail(ex => {
      fm.liveswitch.Log.error("Failed to open upstream connection.", ex);
    });
  }

  // Function for receiver to register with LiveSwitch Gateway, join a channel and create downstream connection
  async function receiverRegisterAndConnect() {
    let promise = new fm.liveswitch.Promise();
    receiverClient = new fm.liveswitch.Client(gatewayUrl, applicationId);
    let channelClaims = [new fm.liveswitch.ChannelClaim(channelId)];
    let token = fm.liveswitch.Token.generateClientRegisterToken(applicationId, receiverClient.getUserId(), receiverClient.getDeviceId(), receiverClient.getId(), null, channelClaims, sharedSecret);
    receiverClient.register(token).then(channels => {
      receiverChannel = channels[0];
      receiverChannel.addOnRemoteUpstreamConnectionOpen(openSfuDownstreamConnection);
      promise.resolve(null);
    }).fail(ex => {
      fm.liveswitch.Log.error("Failed to register receiver.", ex);
      promise.reject(ex);
    });
    return promise;
  }

  async function openSfuDownstreamConnection(remoteConnectionInfo) {
    let remoteMedia = new fm.liveswitch.RemoteMedia(remoteConnectionInfo.getHasAudio(), remoteConnectionInfo.getHasVideo());
    let audioStream = new fm.liveswitch.AudioStream(remoteMedia);
    let videoStream = new fm.liveswitch.VideoStream(remoteMedia);
    let conn = receiverChannel.createSfuDownstreamConnection(remoteConnectionInfo, audioStream, videoStream);
    conn.addOnRemoteUpdate((_, newConnInfo) => {
      if (newConnInfo.getRemoteAudioMuted()) {
        remoteMicMuteIndicator.classList.add("fa-microphone-slash");
      } else {
        remoteMicMuteIndicator.classList.remove("fa-microphone-slash");
      }
      if (newConnInfo.getRemoteVideoMuted()) {
        remoteCameraMuteIndicator.classList.add("fa-eye-slash");
      } else {
        remoteCameraMuteIndicator.classList.remove("fa-eye-slash");
      }
    });
    return conn.open().then(_ => {
      remoteVideo.appendChild(remoteMedia.getView());
    }).fail(ex => {
      fm.liveswitch.Log.error("Failed to open downstream connection.", ex);
    });
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
      return;
    }

    senderRegisterAndConnect();
    receiverRegisterAndConnect();
  }

  // Function to leave the call and stop local media
  function leaveCall() {
    leaveButton.disabled = true;
    muteMicrophoneButton.disabled = true;
    muteCameraButton.disabled = true;
    muteMicrophoneButton.textContent = "Mute Microphone";
    muteCameraButton.textContent = "Mute Camera";
    localMicMuteIndicator.classList.remove("fa-microphone-slash");
    localCameraMuteIndicator.classList.remove("fa-eye-slash");
    remoteMicMuteIndicator.classList.remove("fa-microphone-slash");
    remoteCameraMuteIndicator.classList.remove("fa-eye-slash");

    if (receiverClient) {
      while (remoteVideo.firstChild) {
        remoteVideo.removeChild(remoteVideo.lastChild);
      }
      receiverClient.unregister();
      receiverClient = null;
      receiverChannel = null;
    }

    if (senderClient) {
      senderClient.unregister();
      senderClient = null;
      senderChannel = null;
    }

    if (localAudio) {
      localAudio.stop();
      localAudio = null;
    }
    if (localVideo) {
      localVideo.stop();
      userVideo.innerHTML = '';
      localVideo = null;
    }
    joinButton.disabled = false;
  }

  // Function to toggle microphone mute/unmute
  function toggleMicrophone() {
    muteMicrophoneButton.disabled = true;
    if (localAudio.getState() == fm.liveswitch.LocalMediaState.Started) {
      muteMicrophoneButton.textContent = "Muting Microphone";
      localAudio.stop().then(_ => {
        let config = senderUpstreamConnection.getConfig();
        config.setLocalAudioMuted(true);
        senderUpstreamConnection.update(config).fail(ex => {
          fm.liveswitch.Log.error("Failed to update connection to have audio muted.", ex);
          // Fine to ignore as locally we're muted
        });
        localMicMuteIndicator.classList.add("fa-microphone-slash");
        muteMicrophoneButton.textContent = "Unmute Microphone";
        muteMicrophoneButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error muting local audio.", ex);
        muteMicrophoneButton.textContent = "Mute Microphone";
        muteMicrophoneButton.disabled = false;
      });
    } else {
      muteMicrophoneButton.textContent = "Unmuting Microphone";
      localAudio.start().then(_ => {
        let config = senderUpstreamConnection.getConfig();
        config.setLocalAudioMuted(false);
        senderUpstreamConnection.update(config).fail(ex => {
          fm.liveswitch.Log.error("Failed to update connection to have unmuted audio.", ex);
          // This could be an issue as locally we think we're unmuted, but remote side might not hear us. Investigate why update() failed.
        });
        localMicMuteIndicator.classList.remove("fa-microphone-slash");
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
      muteCameraButton.textContent = "Muting Camera";
      localVideo.stop().then(_ => {
        let config = senderUpstreamConnection.getConfig();
        config.setLocalVideoMuted(true);
        senderUpstreamConnection.update(config).fail(ex => {
          fm.liveswitch.Log.error("Failed to update connection to have video muted.", ex);
          // Fine to ignore as locally we're muted
        });
        localCameraMuteIndicator.classList.add("fa-eye-slash");
        muteCameraButton.textContent = "Unmute Camera";
        muteCameraButton.disabled = false;
      }).fail(ex => {
        fm.liveswitch.Log.error("Error muting local video.", ex);
        muteCameraButton.textContent = "Mute Camera";
        muteCameraButton.disabled = false;
      });
    } else {
      muteCameraButton.textContent = "Unmuting Camera";
      localVideo.start().then(_ => {
        let config = senderUpstreamConnection.getConfig();
        config.setLocalVideoMuted(false);
        senderUpstreamConnection.update(config).fail(ex => {
          fm.liveswitch.Log.error("Failed to update connection to have unmuted video.", ex);
          // This could be an issue as locally we think we're unmuted, but remote side might not hear us. Investigate why update() failed.
        });
        localCameraMuteIndicator.classList.remove("fa-eye-slash");
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