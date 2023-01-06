
// npm install wavesurfer.js 
import { useState, useEffect, useRef } from "react";

const formWaveSurferOptions = (ref) => ({
  container: ref,
  waveColor: "#eee",
  progressColor: "#0178FF",
  cursorColor: "OrangeRed",
  barWidth: 3,
  barRadius: 3,
  responsive: true,
  height: 150,
  normalize: true,
  partialRender: true,
  plugins: [],
});

const WaveSurferNext = ({ children , urlFilePath }) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [toggle, setToggle] = useState(false);
  const [progress, setProgress] = useState(0);

  const url = urlFilePath

  function unmute(context) { // for ios playing when users lock their screen
    // Determine page visibility api
    let pageVisibilityAPI;
    if (document.hidden !== undefined)
      pageVisibilityAPI = {
        hidden: "hidden",
        visibilitychange: "visibilitychange",
      };
    else if (document.webkitHidden !== undefined)
      pageVisibilityAPI = {
        hidden: "webkitHidden",
        visibilitychange: "webkitvisibilitychange",
      };
    else if (document.mozHidden !== undefined)
      pageVisibilityAPI = {
        hidden: "mozHidden",
        visibilitychange: "mozvisibilitychange",
      };
    else if (document.msHidden !== undefined)
      pageVisibilityAPI = {
        hidden: "msHidden",
        visibilitychange: "msvisibilitychange",
      };
    // Determine if ios
    let ua = navigator.userAgent.toLowerCase();
    let isIOS =
      (ua.indexOf("iphone") >= 0 && ua.indexOf("like iphone") < 0) ||
      (ua.indexOf("ipad") >= 0 && ua.indexOf("like ipad") < 0) ||
      (ua.indexOf("ipod") >= 0 && ua.indexOf("like ipod") < 0);

    // Track desired audio state
    let suspendAudio = false;
    let audioUnlockingEvents = [
      "click",
      "contextmenu",
      "auxclick",
      "dblclick",
      "mousedown",
      "mouseup",
      "touchend",
      "keydown",
      "keyup",
    ];

    // Track web audio state
    let contextUnlockingEnabled = false;

    // Track html audio state
    let tag;
    let tagUnlockingEnabled = false;
    let tagPendingChange = false;

    function contextStateCheck(tryResuming) {
      if (context.state == "running") {
        // No need to watch for unlocking events while running
        toggleContextUnlocking(false);

        // Check if our state matches
        if (suspendAudio) {
          // We want to be suspended, we can suspend at any time
          context
            .suspend()
            .then(context_promiseHandler, context_promiseHandler);
        }
      } else if (context.state != "closed") {
        // Interrupted or suspended, check if our state matches
        if (!suspendAudio) {
          // We want to be running
          toggleContextUnlocking(true);
          if (tryResuming)
            context
              .resume()
              .then(context_promiseHandler, context_promiseHandler);
        } else {
          // We don't want to be running, so no need to watch for unlocking events
          toggleContextUnlocking(false);
        }
      }
    }

    function toggleContextUnlocking(enable) {
      if (contextUnlockingEnabled === enable) return;
      contextUnlockingEnabled = enable;
      for (let evt of audioUnlockingEvents) {
        if (enable)
          window.addEventListener(evt, context_unlockingEvent, {
            capture: true,
            passive: true,
          });
        else
          window.removeEventListener(evt, context_unlockingEvent, {
            capture: true,
            passive: true,
          });
      }
    }

    function context_statechange() {
      contextStateCheck(true);
    }

    function context_promiseHandler() {
      contextStateCheck(false);
    }

    function context_unlockingEvent() {
      contextStateCheck(true);
    }

    function tagStateCheck(tryChange) {
      // We have a pending state change, let that resolve first
      if (tagPendingChange) return;

      if (!tag.paused) {
        // No need to watch for unlocking events while running
        toggleTagUnlocking(false);

        // Check if our state matches
        if (suspendAudio) {
          // We want to be suspended, we can suspend at any time
          tag.pause(); // instant action, so no need to set as pending
        }
      } else {
        // Tag isn't playing, check if our state matches
        if (!suspendAudio) {
          // We want to be running
          if (tryChange) {
            // Try forcing a change, so stop watching for unlocking events while attempt is in progress
            toggleTagUnlocking(false);

            // Attempt to play
            tagPendingChange = true;
            let p;
            try {
              p = tag.play();
              if (p) p.then(tag_promiseHandler, tag_promiseHandler);
              else {
                tag.addEventListener("playing", tag_promiseHandler);
                tag.addEventListener("abort", tag_promiseHandler);
                tag.addEventListener("error", tag_promiseHandler);
              }
            } catch (err) {
              tag_promiseHandler();
            }
          } else {
            // We're not going to try resuming this time, but make sure unlocking events are enabled
            toggleTagUnlocking(true);
          }
        } else {
          // We don't want to be running, so no need to watch for unlocking events
          toggleTagUnlocking(false);
        }
      }
    }

    function toggleTagUnlocking(enable) {
      if (tagUnlockingEnabled === enable) return;
      tagUnlockingEnabled = enable;
      for (let evt of audioUnlockingEvents) {
        if (enable)
          window.addEventListener(evt, tag_unlockingEvent, {
            capture: true,
            passive: true,
          });
        else
          window.removeEventListener(evt, tag_unlockingEvent, {
            capture: true,
            passive: true,
          });
      }
    }

    function tag_promiseHandler() {
      tag.removeEventListener("playing", tag_promiseHandler);
      tag.removeEventListener("abort", tag_promiseHandler);
      tag.removeEventListener("error", tag_promiseHandler);

      // Tag started playing, so we're not suspended
      tagPendingChange = false;
      tagStateCheck(false);
    }

    function tag_unlockingEvent() {
      tagStateCheck(true);
    }

    /**
     * A utility function for decompressing the base64 silence string.
     * @param c The number of times the string is repeated in the string segment.
     * @param a The string to repeat.
     */
    function poorManHuffman(c, a) {
      let e;
      for (e = a; c > 1; c--) e += a;
      return e;
    }

    // Watch for tag state changes and check initial state
    if (isIOS) {
      // Is ios, we need to play an html track in the background and disable the widget
      // NOTE: media widget / airplay MUST be disabled with this super gross hack to create the audio tag, setting the attribute in js doesn't work
      let tmp = document.createElement("div");
      tmp.innerHTML = "<audio x-webkit-airplay='deny'></audio>";
      tag = tmp.children.item(0);
      tag.controls = false;
      tag.disableRemotePlayback = true; // Airplay like controls on other devices, prevents casting of the tag
      tag.preload = "auto";

      // Set the src to a short bit of url encoded as a silent mp3
      // NOTE The silence MP3 must be high quality, when web audio sounds are played in parallel the web audio sound is mixed to match the bitrate of the html sound
      // 0.01 seconds of silence VBR220-260 Joint Stereo 859B
      //tag.src = "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADgnABGiAAQBCqgCRMAAgEAH///////////////7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq//////////////////9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
      // The str below is a "compressed" version using poor mans huffman encoding, saves about 0.5kb
      tag.src =
        "data:audio/mpeg;base64,//uQx" +
        poorManHuffman(23, "A") +
        "WGluZwAAAA8AAAACAAACcQCA" +
        poorManHuffman(16, "gICA") +
        poorManHuffman(66, "/") +
        "8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkI" +
        poorManHuffman(320, "A") +
        "//sQxAADgnABGiAAQBCqgCRMAAgEAH" +
        poorManHuffman(15, "/") +
        "7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq" +
        poorManHuffman(18, "/") +
        "9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAw" +
        poorManHuffman(97, "V") +
        "Q==";
      tag.loop = true;
      tag.load();

      // Try to play right off the bat
      tagStateCheck(true);
    }

    // Watch for context state changes and check initial state
    context.onstatechange = context_statechange; // NOTE: the onstatechange callback property is more widely supported than the statechange event	context.addEventListener("statechange", context_statechange);
    contextStateCheck(false);
  }

  useEffect(() => {
    const create = async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      const MarkersPlugin = (await import("wavesurfer.js/src/plugin/markers"))
        .default;

      const options = formWaveSurferOptions(waveformRef.current);
      options.plugins.push(
        MarkersPlugin.create({
          markers: [
             
          ],
        })
      );

      wavesurfer.current = WaveSurfer.create(options);
      wavesurfer.current.load(url);

      wavesurfer.current.on("marker-click", function (marker) {
        console.log("marker drop", marker);
      });

      wavesurfer.current.on("audioprocess", function () {
        const currentTime = wavesurfer.current.getCurrentTime();
        setProgress(currentTime);
      });

      unmute(wavesurfer.current.backend.getAudioContext());

    };

    create();


    return () => {
      if (wavesurfer.current) {
        console.log("destroy");
        wavesurfer.current.destroy();
      }
    };
  }, []);

  const handlePlayPause = () => {
    setPlaying(playing => !playing);
    wavesurfer.current.playPause();
  };

  const back30 = () => {
    wavesurfer.current.skipBackward(30);
  };

  const forward30 = () => {
    wavesurfer.current.skipForward(30);
  };

  return (
    <div>
      <div id="waveform" ref={waveformRef} />
      <div className="controls">
        {/* <button onClick={back30}>Back 30</button> */}
        <button onClick={handlePlayPause}>{!playing ? "Play" : "Pause"}</button>
        {/* <button onClick={forward30}>Forward 30</button> */}
      </div>
      {/* <div className="progress">{progress}</div> */}
    </div>
  );
}

export default WaveSurferNext;
