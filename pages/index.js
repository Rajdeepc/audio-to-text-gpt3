import React, { useEffect, useState } from "react"
import Head from "next/head"
import Image from "next/image"
import styles from "../styles/Home.module.css"
import WaveSurferNext from "../components/video/WaveSurferNext"
import * as filestack from "filestack-js"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const apikey = process.env.NEXT_PUBLIC_FILESTACK_API
const client = filestack.init(apikey)

export default function Home() {
  const [prediction, setPrediction] = useState(null)
  const [error, setError] = useState(null)
  const [audioPath, setAudioFilePath] = useState("")

  const options = {
    displayMode: "inline",
    container: "#inline",
    maxFiles: 2,
    exposeOriginalFile: true,
    uploadInBackground: false,
    accept: "audio/*",
    fromSources: ["local_file_system"],
    onFileSelected: (res) => {
      if(res){
        setAudioFilePath(URL.createObjectURL(res.originalFile))
        console.log(res)
      }
    },
    onUploadDone: (res) => {
      console.log(res)
      setAudioFilePath(
        URL.createObjectURL(res.filesUploaded?.[0]?.originalFile)
      )
      showPredictions(res.filesUploaded?.[0]?.url)
    },
  }
  const picker = client.picker(options)
  picker.open()

  const showPredictions = async (audioPath) => {
    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: audioPath,
        model: "large",
        transcription: "plain text",
        suppress_tokens: -1,
        temperature_increment_on_fallback: 0.2,
        compression_ratio_threshold: 2.4,
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
      }),
    })
    let prediction = await response.json()
    if (response.status !== 201) {
      setError(prediction.detail)
      return
    }
    setPrediction(prediction)

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed"
    ) {
      await sleep(1000)
      const response = await fetch("/api/predictions/" + prediction.id)
      prediction = await response.json()
      if (response.status !== 200) {
        setError(prediction.detail)
        return
      }
      console.log({ prediction })
      setPrediction(prediction)
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Audio - Text ChatGPT3</title>
      </Head>
      {audioPath && (
        <WaveSurferNext extraControls={false} urlFilePath={audioPath} />
      )}

      <div
        id="inline"
        style={{ width: "100%", height: "300px" }}
      ></div>

      {error && <div>{error}</div>}
      {prediction && (
        <div>
          {prediction.output && (
            <>
              <div className="header">
                <div className="transcription">Transcription</div>
                <div>Language: {prediction.output.detected_language}</div>
              </div>
              <div className={styles.imageWrapper}>
                <textarea>{prediction.output.transcription}</textarea>
              </div>
            </>
          )}
          <p>status: {prediction.status}</p>
        </div>
      )}
    </div>
  )
}
