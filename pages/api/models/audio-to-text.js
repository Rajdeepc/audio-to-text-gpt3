import ky from "ky"

export default async function audioTotext(filePath) {
  // The GPT-3 API endpoint for generating completions
  const apiEndpoint = "https://api.replicate.com/v1/predictions"
  const filetype = filePath.split(".").pop()
  const filename = filePath.split("/").pop()
  const fd = new FormData()
  fd.append("audio", {
    uri: filePath,
    type: `audio/${filetype}`,
    name: filename,
  })
  // The request payload
  const data = {
    input : {
        audio: fd,
        transcription: "plain text",
        model: "large",
        suppress_tokens: -1,
        temperature_increment_on_fallback: 0.2,
        compression_ratio_threshold: 2.4,
        logprob_threshold: -1,
        no_speech_threshold: 0.6,
    }
   
  }
  const response = await ky.post(apiEndpoint, {
    body: JSON.stringify(data),
    headers: {
      Authorization: `Token ${process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  })

  if (response.status !== 201) {
    let error = await response.json()
    res.statusCode = 500
    res.end(JSON.stringify({ detail: error.detail }))
    return
  }

  const prediction = await response.json()
  res.statusCode = 201
  res.end(JSON.stringify(prediction))
}
