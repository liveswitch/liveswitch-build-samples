document.addEventListener("DOMContentLoaded", () => {
  const canvasContainer = document.getElementById("canvasContainer");
  
  const joinButton = document.getElementById("joinButton");
  const leaveButton = document.getElementById("leaveButton");
  const timeInput = document.getElementById("time");
  const startTimerButton = document.getElementById("startTimerButton");
  const channelIdSpan = document.getElementById("channelID");

  let localMedia;
  let gatewayUrl = "https://v1.liveswitch.fm:8443/sync";
  let applicationId = "my-app-id";
  let sharedSecret = "--replaceThisWithYourOwnSharedSecret--";

  let channelId = (Math.floor(Math.random() * 900000) + 100000).toString();
  channelIdSpan.innerText = channelId;
  let senderClient;
  let senderChannel;
  let canvas;
  let stream;

  let lastTimeInSeconds;
  let timerRunning = false;
  let currentTime;

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

  // Function to set up and display local video
  async function startLocalMedia() {
    try {
      try {
        // create a reference to the local video stream
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: width, height: height }
        });
      } catch (ex) { }
      const video = document.createElement("video");
      // set the source of the video dom element to the local stream
      video.srcObject = stream;
      // create video element onLoadMetaData handler
      video.onloadedmetadata = function async(e) {
        // start playing the video once we have the meta data
        video.play();
      };
      // create a new canvas object
      canvas = document.createElement("canvas");
      // configure it to be 2 dimensiona;
      const ctx = canvas.getContext("2d");
      // add the new canvas object to the DOM
      canvasContainer.appendChild(canvas);
      // set the size of the canvas
      canvas.width = width;
      canvas.height = height;

      let draw = () => {
        // clear previous results
        ctx.clearRect(0, 0, width, height);
        // draw new reults to the canvas
        ctx.drawImage(video, 0, 0, width, height);
        if (timerRunning) {
          ctx.fillStyle = "white";
          ctx.fillRect((width/2) - 45, 5, 100, 40);
          ctx.fillStyle = "black";
          ctx.font = "30px Arial";
          const date = new Date();
          let minute = Math.floor(currentTime/60)
          let second = currentTime%60
          if (minute < 10) minute = "0" + minute
          if (second < 10) second = "0" + second
          ctx.fillText(
            minute + ":" + second,
            (width/2) - 35,
            35
          );
          // console.log("getSeconds: " + date.getSeconds() + " lastTime: " + lastTimeInSeconds)
          if (currentTime > 0) {
            if (date.getSeconds() !== lastTimeInSeconds) {
              lastTimeInSeconds = date.getSeconds();
              currentTime--;
            } 
          }
          else {
            startTimerButton.disabled = false;
            timerRunning = false;
          }
          
      }

        window.requestAnimationFrame(draw);
      };
      window.requestAnimationFrame(draw);

      // get the stream from the canvas object with the drawing on it
      let st = canvas.captureStream(60);
      
      // create a local media object using the canvas stream
      localMedia = new fm.liveswitch.LocalMedia(true, st);
      
      await localMedia.start();
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
    
    let conn = senderChannel.createSfuUpstreamConnection(audioStream, videoStream);
    
    return conn.open().fail(ex => {
      fm.liveswitch.Log.error("Failed to open upstream connection.", ex);
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

    senderRegisterAndConnect();
  }

  // Function to leave the call and stop local media
  function leaveCall() {
    leaveButton.disabled = true;

    if (senderClient) {
      senderClient.unregister();
      senderClient = null;
      senderChannel = null;
    }

    if (localMedia) {
      localMedia.stop();
      canvasContainer.removeChild(canvas);
      localMedia = null;
      canvas = null;
      stream.getTracks().forEach(function(track) {
        track.stop();
      });
      stream = null;
    }
    joinButton.disabled = false;
    currentTime = null;
    startTimerButton.disabled = false;
  }

  function startTimer() {
    startTimerButton.disabled = true;

    timerRunning = true;
    currentTime = parseInt(timeInput.value)*60;
    lastTimeInSeconds = new Date().getSeconds();
  }

  // Event listeners for buttons
  joinButton.addEventListener("click", joinCall);
  leaveButton.addEventListener("click", leaveCall);
  startTimerButton.addEventListener("click", startTimer);
});