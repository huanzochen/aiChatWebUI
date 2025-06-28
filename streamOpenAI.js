async function processStream(body, onUpdate) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let aiReply = '';

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.replace(/^data: /, '');
        if (dataStr === '[DONE]') {
          done = true;
          break;
        }
        try {
          const dataObj = JSON.parse(dataStr);
          const content = dataObj.choices?.[0]?.delta?.content;
          if (content) {
            aiReply += content;
            if (onUpdate) {
              onUpdate(aiReply);
            }
          }
        } catch (e) {
          console.error('Error parsing stream data', e);
        }
      }
    }
  }

  return aiReply;
}

export async function streamChatCompletion({ apiKey, model, messages, onUpdate }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error('API Error: ' + response.status);
  }

  return await processStream(response.body, onUpdate);
}
