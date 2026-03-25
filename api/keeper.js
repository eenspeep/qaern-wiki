// Vercel serverless function — proxies requests to Anthropic API
// so the API key never touches the browser.
// Deploy env var: ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, articles } = req.body
    if (!messages) return res.status(400).json({ error: 'Missing messages' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const allArticles = Object.values(articles || {})

  // Always build a lightweight index — title, id, category, subtitle only
  const wikiIndex = allArticles.map(a =>
    `[id: ${a.id}] ${a.title} (${a.category})${a.subtitle ? ' — ' + a.subtitle : ''}`
  ).join('\n')

  // Detect which articles are referenced in the latest user message
  const contentToString = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.map(p => p.text || '').join(' ') : ''
  const lastUserMsg = contentToString([...messages].reverse().find(m => m.role === 'user')?.content || '')
  const referencedArticles = allArticles.filter(a => {
    const needle = lastUserMsg.toLowerCase()
    return needle.includes(a.title.toLowerCase()) ||
           needle.includes(a.id.toLowerCase()) ||
           needle.includes((a.subtitle || '').toLowerCase())
  })

  // Also include articles referenced in the last few assistant messages (for follow-ups)
  const recentHistory = messages.slice(-6)
  const contextArticles = allArticles.filter(a => {
    return recentHistory.some(m => {
      const t = contentToString(m.content).toLowerCase()
      return t.includes(a.title.toLowerCase()) || t.includes(a.id.toLowerCase())
    })
  })

  // Merge — unique by id
  const fullArticleIds = new Set([
    ...referencedArticles.map(a => a.id),
    ...contextArticles.map(a => a.id),
  ])

  // Always include one example article for house style reference (longest article by content)
  const longestArticle = allArticles
    .filter(a => !fullArticleIds.has(a.id))
    .sort((a, b) => (b.content || '').length - (a.content || '').length)[0]
  if (longestArticle) fullArticleIds.add(longestArticle.id)

  // Build full content only for selected articles
  const fullArticleContext = allArticles
    .filter(a => fullArticleIds.has(a.id))
    .map(a => {
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
EXCEPTION: If the GM explicitly waives confirmation — phrases like "no confirmation", "just do it", "skip confirmation", "don't ask", "auto", or similar — skip the description step and execute immediately by including `"autoCommit": true` in the wiki_action or wiki_actions block.

HOUSE STYLE — CRITICAL: Sample article HTML is provided below. Before writing any content, study how existing articles are structured — their heading levels, paragraph style, use of <strong> for key terms, section organisation, tone, and length. All new or edited content must match this house style precisely. Do not invent new HTML patterns; mirror what you see.

CRITICAL RULE FOR EDITING: Each article has an "id" shown in brackets like [id: the-peace-king]. When editing an existing article, you MUST use that exact id in the wiki_action block. Never re-slugify or guess the id — a wrong id creates a duplicate instead of editing the original.

When editing an existing article, include ALL fields in the wiki_action — carry over any infobox, subtitle, and content you are not explicitly changing. Never blank a field unless the GM asked you to clear it.

To perform one OR MORE wiki actions, output a JSON block at the END of your response (after your prose).

For a SINGLE article, use:
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

For MULTIPLE articles at once, use:
<wiki_actions>
[
  {
    "action": "create" | "edit",
    "id": "first-article-id",
    "title": "First Article Title",
    "category": "Category Name",
    "subtitle": "Optional subtitle",
    "infobox": { "Key": "Value" },
    "content": "<p>HTML content here</p>"
  },
  {
    "action": "edit",
    "id": "second-article-id",
    "title": "Second Article Title",
    "category": "Category Name",
    "subtitle": "Optional subtitle",
    "infobox": {},
    "content": "<p>HTML content here</p>"
  }
]
</wiki_actions>

Use the multi-action format whenever the GM asks you to update several articles at once. You may edit as many articles as needed in a single block.
Only include the wiki_action or wiki_actions block when actually executing a confirmed change — never speculatively.
Add `"autoCommit": true` to the root of the block only when the GM has explicitly waived confirmation for this request.

All articles (index — title, id, category):
${wikiIndex || '(The wiki is empty.)'}

Full content of relevant articles (referenced in this conversation):
${fullArticleContext || '(No specific articles loaded — if you need me to read a specific article, mention it by name.)'}

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
  } catch (outerErr) {
    res.status(500).json({ error: 'Handler error: ' + outerErr.message })
  }
}
