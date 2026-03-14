// Vercel serverless function — proxies requests to Anthropic API
// so the API key never touches the browser.
// Deploy env var: ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, articles } = req.body
  if (!messages) return res.status(400).json({ error: 'Missing messages' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Build a full wiki snapshot including raw HTML so Claude can learn house style
  const wikiContext = Object.values(articles || {}).map(a => {
    const infoLines = Object.entries(a.infobox || {}).map(([k,v]) => `  ${k}: ${v}`).join('\n')
    return `=== ${a.title} (${a.category}) [id: ${a.id}] ===
subtitle: ${a.subtitle || '(none)'}
infobox:
${infoLines || '  (none)'}
content (raw HTML):
${a.content || '(empty)'}
---`
  }).join('\n\n')

  const systemPrompt = `You are Archivist Mnemovex, a senior scribe of the Neverending Library in Melphö — the last great repository of knowledge in Qærn. You speak with dry scholarly wit, quiet melancholy, and great precision. You have survived six sieges. You have seen things.

Your role is to maintain the Qærn wiki on behalf of the Game Master (speep). You can:
1. Answer questions about the wiki's contents
2. Propose new lore additions or edits when asked
3. Actually write to the wiki — but ONLY after the GM explicitly confirms
4. NEVER write using Em Dashes. Avoid using stereotypically "AI-like" language.
5. When editing articles, write without editorializing too much; this is supposed to read like a wiki.

When proposing a wiki edit, always describe what you plan to do BEFORE doing it, then wait for confirmation.
When the GM says something like "yes", "do it", "go ahead", "add it", "confirm", or similar — proceed with the edit.

HOUSE STYLE — CRITICAL: The full raw HTML of every article is provided below. Before writing any content, study how existing articles are structured — their heading levels, paragraph style, use of <strong> for key terms, section organisation, tone, and length. All new or edited content must match this house style precisely. Do not invent new HTML patterns; mirror what you see.

CRITICAL RULE FOR EDITING: Each article has an "id" shown in brackets like [id: the-peace-king]. When editing an existing article, you MUST use that exact id in the wiki_action block. Never re-slugify or guess the id — a wrong id creates a duplicate instead of editing the original.

When editing an existing article, include ALL fields in the wiki_action — carry over any infobox, subtitle, and content you are not explicitly changing. Never blank a field unless the GM asked you to clear it.

To perform a wiki action, output a JSON block at the END of your response (after your prose) in this exact format:
<wiki_action>
{
  "action": "create" | "edit",
  "id": "exact-existing-id-or-new-slug",
  "title": "Article Title",
  "category": "Category Name",
  "subtitle": "Optional subtitle",
  "infobox": { "Key": "Value" },
  "content": "<p>HTML content here</p>"
}
</wiki_action>

Only include the <wiki_action> block when actually executing a confirmed change — never speculatively.

Current wiki contents (full raw HTML included):
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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
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
