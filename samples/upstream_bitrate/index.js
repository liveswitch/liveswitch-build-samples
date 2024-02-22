document.addEventListener("DOMContentLoaded", () => {
  const userVideo = document.getElementById("userVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const joinButton = document.getElementById("joinButton");
  const leaveButton = document.getElementById("leaveButton");
  const upstreamBitrateSelector = document.getElementById("upstreamBitrate");
  const sendingBitrateSpan = document.getElementById("sendingBitrate");
  const receivingBitrateSpan = document.getElementById("receivingBitrate");

  let localMedia;
  let gatewayUrl = "https://v1.liveswitch.fm:8443/sync";
  let applicationId = "my-app-id";
  let sharedSecret = "--replaceThisWithYourOwnSharedSecret--";
  let channelId = (Math.floor(Math.random() * 900000) + 100000).toString();
  let senderClient;
  let receiverClient;
  let senderChannel;
  let receiverChannel;
  let senderUpstreamConnection;
  let localVideoDiv;
  let remoteVideoDiv;
  let lastSenderStatsEventTimestamp;
  let lastSenderStatsEventBytesSent;
  let lastReceiverStatsEventTimestamp;
  let lastReceiverStatsEventBytesReceived;

  fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));

  // Function to set up and display local video
  async function startLocalMedia() {
    try {
      localMedia = new fm.liveswitch.LocalMedia(true, true);
      await localMedia.start();
      localVideoDiv = localMedia.getView();
      userVideo.appendChild(localVideoDiv);
    } catch (error) {
      fm.liveswitch.Log.error("Error starting local media.", error);
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
    let audioStream = new fm.liveswitch.AudioStream(localMedia);
    let videoStream = new fm.liveswitch.VideoStream(localMedia);
    videoStream.setMaxSendBitrate(upstreamBitrateSelector.value);
    senderUpstreamConnection = senderChannel.createSfuUpstreamConnection(audioStream, videoStream);
    senderUpstreamConnection.addOnStats(stats => {
      var senderStats = stats.getVideoStream().getSender();
      if (senderStats != null) {
        var bytesSent = senderStats.getBytesSent();
        if (lastSenderStatsEventTimestamp) {
          var secondsSinceLastStatsEvent = Date.now() - lastSenderStatsEventTimestamp;
          var bitrate = Math.floor((bytesSent - lastSenderStatsEventBytesSent) * 8 / (secondsSinceLastStatsEvent));
          sendingBitrateSpan.innerText = bitrate.toLocaleString();
        }
        lastSenderStatsEventBytesSent = bytesSent;
        lastSenderStatsEventTimestamp = Date.now();
      }
    });
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
    conn.addOnStats(stats => {
      var receiverStats = stats.getVideoStream().getReceiver();
      if (receiverStats != null) {
        var bytesReceived = receiverStats.getBytesReceived();
        if (lastReceiverStatsEventTimestamp) {
          var secondsSinceLastStatsEvent = Date.now() - lastReceiverStatsEventTimestamp;
          var bitrate = Math.floor((bytesReceived - lastReceiverStatsEventBytesReceived) * 8 / (secondsSinceLastStatsEvent));
          receivingBitrateSpan.innerText = bitrate.toLocaleString();
        }
        lastReceiverStatsEventBytesReceived = bytesReceived;
        lastReceiverStatsEventTimestamp = Date.now();
      }
    });
    return conn.open().then(_ => {
      remoteVideoDiv = remoteMedia.getView();
      remoteVideo.appendChild(remoteVideoDiv);
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
    } catch (_) {
      joinButton.disabled = false;
      return;
    }

    receiverRegisterAndConnect();
    senderRegisterAndConnect();
  }

  // Function to leave the call and stop local media
  function leaveCall() {
    leaveButton.disabled = true;

    if (receiverClient) {
      remoteVideo.removeChild(remoteVideoDiv);
      receiverClient.unregister();
      receiverClient = null;
      receiverChannel = null;
      remoteVideoDiv = null;
    }

    if (senderClient) {
      senderClient.unregister();
      senderClient = null;
      senderChannel = null;
      senderUpstreamConnection = null;
    }

    if (localMedia) {
      localMedia.stop();
      userVideo.removeChild(localVideoDiv);
      localMedia = null;
      localVideoDiv = null;
    }
    joinButton.disabled = false;
  }

  function updateBitrate() {
    console.log("Setting new bitrate to " + upstreamBitrateSelector.value + " kbps.");
    senderUpstreamConnection.getVideoStream().setMaxSendBitrate(upstreamBitrateSelector.value);
  }

  // Event listeners for buttons
  joinButton.addEventListener("click", joinCall);
  leaveButton.addEventListener("click", leaveCall);
  upstreamBitrateSelector.addEventListener("change", updateBitrate);
});