document.addEventListener("DOMContentLoaded", () => {
  
  const joinButton = document.getElementById("joinButton");
  const leaveButton = document.getElementById("leaveButton");
  const channelIdInput = document.getElementById("channelID");

  const header = document.getElementById("header");

  let gatewayUrl = "https://v1.liveswitch.fm:8443/sync";
  let applicationId = "my-app-id";
  let sharedSecret = "--replaceThisWithYourOwnSharedSecret--";
  // let gatewayUrl = "https://cloud.liveswitch.io";
  // let sharedSecret = "0070c9c582894ef7969986ba228399c527201d910ed9451eb8b45097194ad689";
  // let applicationId = "62c0809a-5671-426f-94a5-8edbdd1fe962";
  
  const remoteVideo = document.getElementById("remoteVideo");

  let height = 720;
  let width = 1280;

  if (window.innerHeight < 500) {
    height = 250;
    width = 640;
  }
  else if (window.innerHeight < 1000) {
    height = 400;
    width = 350;
  }

  fm.liveswitch.Log.registerProvider(new fm.liveswitch.ConsoleLogProvider(fm.liveswitch.LogLevel.Debug));

  // Function for receiver to register with LiveSwitch Gateway, join a channel and create downstream connection
  async function receiverRegisterAndConnect() {
    let promise = new fm.liveswitch.Promise();
    receiverClient = new fm.liveswitch.Client(gatewayUrl, applicationId);
    let channelClaims = [new fm.liveswitch.ChannelClaim(channelIdInput.value)];
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
    receiverDownstreamConnection = receiverChannel.createSfuDownstreamConnection(remoteConnectionInfo, audioStream, videoStream);
    
    return receiverDownstreamConnection.open().then(_ => {
      remoteVideoDiv = remoteMedia.getView();
      remoteVideo.appendChild(remoteVideoDiv);
    }).fail(ex => {
      fm.liveswitch.Log.error("Failed to open downstream connection.", ex);
    });
  }

  // Function to join the call
  async function joinCall() {
    joinButton.disabled = true;

    header.style.display = "none";
    receiverRegisterAndConnect()
    leaveButton.disabled = false;
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
      receiverDownstreamConnection = null;
    }

    header.style.display = "";
    joinButton.disabled = false;
   
  }

  // Event listeners for buttons
  joinButton.addEventListener("click", joinCall);
  leaveButton.addEventListener("click", leaveCall);
});