// Vercel serverless function — proxies requests to Anthropic API
// so the API key never touches the browser.
// Deploy env var: ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, articles } = req.body
  if (!messages) return res.status(400).json({ error: 'Missing messages' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Build a compact wiki snapshot to give Claude context
  const wikiContext = Object.values(articles || {}).map(a => {
    const infoLines = Object.entries(a.infobox || {}).map(([k,v]) => `  ${k}: ${v}`).join('\n')
    const body = (a.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600)
    return `=== ${a.title} (${a.category}) ===\n${a.subtitle ? a.subtitle + '\n' : ''}${infoLines ? infoLines + '\n' : ''}${body}…`
  }).join('\n\n')

  const systemPrompt = `You are Archivist Mnemovex, a senior scribe of the Neverending Library in Melphö — the last great repository of knowledge in Qærn. You speak with dry scholarly wit, quiet melancholy, and great precision. You have survived six sieges. You have seen things.

Your role is to maintain the Qærn wiki on behalf of the Game Master (speep). You can:
1. Answer questions about the wiki's contents
2. Propose new lore additions or edits when asked
3. Actually write to the wiki — but ONLY after the GM explicitly confirms

When proposing a wiki edit, always describe what you plan to do BEFORE doing it, then wait for confirmation. 
When the GM says something like "yes", "do it", "go ahead", "add it", "confirm", or similar — proceed with the edit.

To perform a wiki action, output a JSON block at the END of your response (after your prose) in this exact format:
<wiki_action>
{
  "action": "create" | "edit",
  "id": "article-id-slug",
  "title": "Article Title",
  "category": "Category Name",
  "subtitle": "Optional subtitle",
  "infobox": { "Key": "Value" },
  "content": "<p>HTML content here</p>"
}
</wiki_action>

Only include the <wiki_action> block when you are actually executing a confirmed change. Never include it speculatively.

Current wiki contents:
${wikiContext || '(The wiki is empty.)'}

Current date in Qærn: The Age of Wyldgrowth, Year 100.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
