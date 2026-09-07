async function test() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const models = ["google/gemini-2.5-flash", "google/gemini-flash-1.5", "google/gemini-2.0-flash-001"];
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: "user", content: "Hello in 3 words" }]
        })
      });
      const data = await res.json();
      console.log(`Model ${model} -> Status: ${res.status}, Answer:`, data.choices?.[0]?.message?.content || data.error?.message);
    } catch (e: any) {
      console.log(`Model ${model} error:`, e.message);
    }
  }
}
test();
