const axios = require("axios")

export default async function summarizeText(text, summaryLength) {
  // Replace YOUR_API_KEY with your actual API key
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_TOKEN

  // The GPT-3 API endpoint for generating completions
  const apiEndpoint = "https://api.openai.com/v1/completions"

  // The request payload
  const data = {
    prompt: `Summarize this text in ${summaryLength} words or fewer: ${text}`,
    max_tokens: summaryLength,
    temperature: 0,
    top_p: 1,
    stream: false,
    logprobs: null,
    model: "text-davinci-003",
  }
  try {
    // Make the request to the GPT-3 API
    const response = await axios.post(apiEndpoint, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })

    // Return the summary
    return response.data.choices[0].text
  } catch (e) {
    if (e) {
      console.log(e)
      throw e
    }
  }
}
