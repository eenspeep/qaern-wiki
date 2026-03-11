// Run this once to seed Firestore with the default articles.
// Import and call seedArticles() from your browser console or a one-time script.
// After seeding, you can delete/ignore this file.

export const INITIAL_ARTICLES = {
  "the-wyld": {
    id:"the-wyld",title:"The Wyld",category:"Lore & History",
    subtitle:"The Rampant Overgrowth of the Peace King",
    infobox:{"Also Known As":"The Wyldgrowth","Caused By":"The Peace King","Occurred":"~100 years ago","Effect":"Destroyed all major civilizations","Status":"Ongoing, all-consuming"},
    content:`<p>The Wyld — sometimes called the Wyldgrowth — is the rampant, supernatural overgrowth that has consumed the world of Qærn for the past one hundred years. It is the direct result of the Peace King's forced matrimony with Qaern, the sleeping Earthmother, which amplified his divine power tenfold and allowed him to reshape the planet entirely.</p>
<h2>Origins</h2>
<p>Before the Wyldgrowth, Qærn was a world of competing nations, ambitious empires, and fractious peoples. It was a world of conflict — but also of civilization, commerce, and culture. The Peace King, a newly-deified god-emperor of Hallan and patron of Melphö, had ushered in an era of unprecedented armistice between men, dwarves, and elves.</p>
<p>When the Thelonians broke his peace by waging a great naval war, the Peace King responded by erasing them from existence. In doing so, he revealed the terrible truth: he was not a peacekeeper. He was a god of absolute control. Fearing that mankind was corrupted beyond redemption, he decided a grand reset was necessary.</p>
<p>He forced matrimony upon the sleeping goddess Qaern herself — the planet made flesh — and, fortified by her divine essence, he entered a chrysalis. From within it, he unleashed the Wyldgrowth upon the world.</p>
<h2>Nature of the Wyld</h2>
<p>Overnight, the world changed beyond recognition. Oceans dried up and were replaced by salty coral jungles. Forests became dense, fog-filled wastelands. Plains vanished under miles of vine and canopy. Every major civilization was consumed, every road swallowed, every city buried.</p>
<p>The Wyld is not simply overgrown nature. It is the Peace King's demesne — his perfect, terrible peace. Within it, the Wyldgrowth actively maddens those who cannot find refuge. Sleeping even once in the Wyld allows the madness to seep in: nightmares first, then ill omens, then transformation.</p>
<p>Those who succumb entirely become <strong>Wyldmen</strong> — animalistic servitors of the Peace King, trapped between human and beast. Their howls carry beyond the walls of the last settlements every night. They must have so much food out there.</p>
<h2>Living in the Wyld's Shadow</h2>
<p>The few settlements that remain — "points of light" in the endless dark — survive through walls, vigilance, and desperate cooperation. Beyond those walls, the Wyld presses in constantly. Travelers who venture out face not only Wyldmen, but the slow corruption of the place itself.</p>
<p>The Peace King, for his part, has not been seen since his chrysalis. Whether he watches, sleeps, or simply <em>is</em> — woven into every root and vine — no one knows for certain.</p>`
  },
  "men-of-qaern":{
    id:"men-of-qaern",title:"Men of Qærn",category:"Peoples",
    subtitle:"Humanity in a World Undone",
    infobox:{"Also Called":"Humans","Former Nations":"Arcadia, Iasoli, Copyria, Thelonia, Hallene, Kolys, Xenopolia","Empire":"The Helenian Empire (dissolved)","Subtypes":"Man, Accursed, Wyldman","Motto":"\"Peace, above all else.\""},
    content:`<p>Men — more formally called humans — are one of the three primary peoples of Qærn, and arguably the most changed by the Peace King's Wyldgrowth. Once the architects of the Helenian Empire, humans now cling to the remnants of their civilization in walled settlements, wandering bands, and — for those lost entirely — the Wyld itself.</p>
<h2>History</h2>
<p>Humans are unique among Qærn's peoples in that they are <em>of</em> this world in a way neither dwarves nor elves can claim. Where dwarves were forged in molten stone and elves descended from the cosmos, men sprang from the wilds of Qærn itself, banding together to form villages, towns, city-states, nations, and eventually the Helenian Empire.</p>
<p>The Empire, led by the Peace King, brought an unprecedented era of armistice between men, dwarves, and elves. It seemed, for a time, that humanity had achieved something remarkable.</p>
<p>Then the Thelonians broke the peace. The Peace King destroyed them. And in doing so, revealed himself — not as a king in a long line of peacekeepers, but as a newly-deified god-emperor capable of terrible power. The men of Qærn feared him, worshipped him, and ultimately had no choice but to do both.</p>
<p>When the Wyldgrowth came, a hundred years ago, it was their civilization that fell hardest. Unlike dwarves sheltered by dragons in the northern mountains, or elves safe behind cosmic magic in their wodes and spires, men had nothing but walls and each other.</p>
<h2>Subtypes</h2>
<p><strong>Man</strong> is the baseline human: diverse in appearance, ranging from porcelain to ebony skin, white to black hair, typically between five and six feet tall. They live in walled settlements or travel in bands across the Wyld, motivated by survival, innovation, and the hunger to rebuild.</p>
<p><strong>The Accursed</strong> carry Thelonian blood — more common than anyone would care to admit. This blood manifests as one of two curses. Some are struck with <em>devilry</em>: horns, tails, strange eye colors, or skin in unnatural hues. Others become <em>the Nameless</em> — unable to be named at birth, given instead virtue-words or trait-words: Goodness, Brawn, Leggy, Mockingbird. Some are both. They are simultaneously hated and kept as symbols, totems of a world that refuses to fully die.</p>
<p><strong>Wyldmen</strong> are the lost. Men and women consumed entirely by the Wyld's madness, their humanity overtaken by bestial traits. In extreme cases, they are indistinguishable from animals. They serve the Peace King, whether they know it or not, living in warbands or as lone hunters. Their howls echo beyond the walls every night.</p>
<h2>Special Qualities</h2>
<p>Humans share an inexplicable sense for magic — a taste in the air, a pressure behind the eyes, a sulfurous warmth when the arcane is near. No one knows why. Some theorize the old world of men was built along invisible leylines by instinct rather than design.</p>
<p>Men also retain the ability to commune with Wyld-touched beings — Wyldmen, Beastkin, and creatures influenced by the Wyldgrowth. This includes the right to call <strong>parley</strong> with Wyldmen, who must accept its terms until matters are fairly settled.</p>
<h2>Faith</h2>
<p>Before the Peace King, men worshipped the <strong>Hallenious gods</strong> — household deities tended at hearths and altars in the safety of homes, which, in those days, beasts could not enter without invitation. These gods sent <strong>saints</strong> as pseudo-avatars into the world: mortal, and typically martyred. Dead saints can still be bargained with, beseeched, and in rare cases, summoned.</p>
<p>Today, most men worship the Peace King above all else, if only because they have no other choice. The Hallenious gods are practiced in secret, their names more often used as curses than prayers.</p>`
  },
  "elves-of-qaern":{
    id:"elves-of-qaern",title:"Elves of Qærn",category:"Peoples",
    subtitle:"Ancient Starwalkers, Children of Another World",
    infobox:{"Homeworld":"Ælfyn (destroyed)","Arrived":"Thousands of years ago","Subtypes":"True Elf (Star Elf), Qærani (Earth Elf), Half-Elf","Last Birth":"~100 years ago","Lifespan":"Functionally immortal (True Elves)"},
    content:`<p>The elves of Qærn are not, strictly speaking, <em>of</em> Qærn at all. They are refugees — cosmic survivors from a long-dead world called Ælfyn — who arrived on Qærn in what their people call the <strong>Time of Starwalking</strong>, descending in what men of that era mistook for meteorites.</p>
<h2>Origins: The Time of Starwalking</h2>
<p>When Ælfyn died, the elves fled. Their journey through the cosmos — three starlengths of desperate search — shaped them in ways that have never fully healed. The elves made alliances with <strong>fey</strong>, ancient beings from outside the universe, to guide them to a new home. That home was Qærn.</p>
<h2>Divergence: Two Peoples</h2>
<p>Upon arrival, elves diverged in philosophy and, over millennia, in form.</p>
<p><strong>True Elves</strong> — called Star Elves — rejected Qærn's nature entirely. They built impossible spires, took humans as labor, and constructed physics-defying cities on the strength of pure magic. Their hubris cost them: human rebellions toppled their civilizations one by one. Some remnants remain in their spires, stagnant and dreaming.</p>
<p><strong>Qærani</strong> — called Earth Elves — integrated with Qærn. They grew shorter, more human in scale, took to the forests, and transformed woodlands into magical hotspots called <strong>wodes</strong>. They made it their purpose to prevent Qærn from suffering the fate of Ælfyn.</p>
<p><strong>Half-Elves</strong> are a newer phenomenon — those born of elven lineage, in wodes, or sometimes completely inexplicably. No full-blooded elf has been born since the Wyldgrowth began a hundred years ago.</p>
<h2>Special Qualities</h2>
<p>Elves have a disturbing ancestral rite: consuming the sensory organs of a fallen elf grants access to that elf's last perceptions — their final sight, sound, or thought.</p>
<p>True Elves do not age past the moment of their first genuine self-awareness. Most living True Elves are between five hundred and five thousand years old.</p>
<p>Elves also give fragments of their sleep to others — those who camp alongside elves for extended periods may find themselves pulled into elven dreamscapes: visions of stars, dead worlds, and futures unformed.</p>
<h2>Faith</h2>
<p>Elves acknowledge the <strong>Starlaws</strong> — primal forces of the universe — as natural phenomena rather than true deities. These forces have taken on names in Qærn's cultures: <em>Constellus</em> (Creation), <em>Kil</em> (Time), the <em>Martyr</em> (Death), the <em>Dreamer</em> (Imagination).</p>`
  },
  "dwarves-of-qaern":{
    id:"dwarves-of-qaern",title:"Dwarves of Qærn",category:"Peoples",
    subtitle:"Stone-Born, Dragon-Shielded, Unbroken",
    infobox:{"Homelands":"Huthvir Grumvhor (mountains), Borobos (hills)","Subtypes":"Clandwarf, Borobian, Shortbeard","Unique Trait":"Cannot be raised from the dead","Protectors":"The Dragons of the North","Motto":"\"Dig to crack the Heart.\""},
    content:`<p>Dwarves are among the oldest sapient inhabitants of Qærn. Builders, miners, and hero-worshippers, they leave monuments wherever they go — dungeons, relics, and carved faces in stone that span from the northern mountainhomes all the way to the deep wodes of the far south.</p>
<h2>History</h2>
<p>When the Peace King unleashed the Wyldgrowth, dwarves alone among the major peoples found meaningful shelter. A congress of dragons — the ancestral enemies of dwarvenkind — convened with uncharacteristic purpose and shielded the mountain stronghold of <strong>Huthvir Grumvhor</strong> and the Borobian plains from the worst of the devastation.</p>
<p>This has resulted in a complicated, prickly reverence: dwarves owe their survival to creatures they fundamentally despise.</p>
<h2>Subtypes</h2>
<p><strong>Clandwarves</strong> hail from Huthvir Grumvhor. They leave only on <strong>heroquests</strong>: grand, singular missions to earn a title and engrave a name in the walls of the Throne of Heaven.</p>
<p><strong>Borobian Dwarves</strong> broke away from the mountainhome clans to build communal societies in the hills and valleys of <strong>Borobos</strong>.</p>
<p><strong>Shortbeard Dwarves</strong> are the unincorporated — raised in the wylds of Qærn proper, without clan or commune.</p>
<h2>Special Qualities</h2>
<p>When a dwarf is born, a piece of their soul is placed in the stone. This means dwarves <strong>cannot be raised from the dead</strong> without first being properly memorialized. No dwarven zombie has ever walked Qærn.</p>
<p>Dwarves also possess <strong>dungeon-sense</strong>: an instinctive awareness of architecture, stonework, and spatial geometry.</p>
<h2>Faith</h2>
<p>Dwarves worship <strong>heroes</strong>. The <strong>Seven Herodwarves</strong> comprise the most common household worship: <strong>Dugmaren Sharptack</strong> (Invention), <strong>Vergaradar Brightmantle</strong> (Discovery), <strong>Rugkarok Wisemask</strong> (Problem-Solving), <strong>Polytropos Mountainking</strong> (Mountains), <strong>Thena Alebringer</strong> (Life), <strong>Pogoth Wyrmshield</strong> (Heroes), and <strong>Tholus Lifetree</strong> (Nature).</p>
<p>Dwarves also believe in <strong>the Worldheart</strong> — a gemstone the size of a fortress deep within Qærn's core. None have found it. None have stopped digging.</p>`
  },
  "melpho":{
    id:"melpho",title:"Melphö",category:"Locations",
    subtitle:"City of Forgotten Splendor",
    infobox:{"Type":"Walled Settlement / Campaign Hub","Former Glory":"Home of the greatest mage academy on Qærn","Patron State":"Hallan (dissolved)","Factions":"The Amber Ceremony, The Scarlet Pyre","Status":"Rebuilding after the Sixth Siege","Survival":"100 / 200"},
    content:`<p>Melphö is an ancient city — one of the last true points of light in Qærn's vast Wyld. Filled with the architectural bones of bygone splendors, it stands today as a beacon against the darkness of the ever-approaching Wyldgrowth.</p>
<h2>History</h2>
<p>Before the Peace King's reign, Melphö was the intellectual crown jewel of Hallan — home to the most prestigious mage academy on Qærn, which produced three true wizards in its short history. It housed the <strong>Neverending Library</strong> and the <strong>Scarlet Pyre</strong>, a guild of adventurers whose ceremonial flame has burned for generations.</p>
<p>When the Wyldgrowth came, Melphö's walls held. Barely. The city has survived six sieges — six direct assaults from the Wyld's forces — and has endured each one at terrible cost.</p>
<h2>Present Day</h2>
<p>The <strong>Sixth Siege</strong> has only recently passed. In an unprecedented act, the city's two primary factions — the <strong>Amber Ceremony</strong> and the <strong>Scarlet Pyre</strong> — have begun collaborating in the name of Melphö's survival. This alliance is fragile, born of necessity.</p>
<p>A darkness still looms beyond the gates. Whether Melphö represents humanity's last real hope — or simply its last gasp — depends entirely on those brave or foolish enough to call it home.</p>
<h2>Institutions</h2>
<p><strong>The Amber Ceremony</strong> <em>(Level 1)</em> — +1 speed for members titled "the Celebrant."</p>
<p><strong>The Scarlet Pyre</strong> <em>(Level 1)</em> — +1 stability for members titled "the Pyreling."</p>
<p><strong>The Open End</strong> <em>(In Progress, 12.5%)</em> — A tavern attracting refugees and travelers.</p>
<h2>Geography</h2>
<p>Melphö is isolated — separated from other surviving settlements by dense, impassable Wyldgrowth. The city's walls are high, and the signs at every gate read the same: <em>Leave.</em></p>`
  },
  "amber-ceremony":{
    id:"amber-ceremony",title:"The Amber Ceremony",category:"Factions",
    subtitle:"Guardians of Knowledge, Keepers of the Library",
    infobox:{"Type":"Adventuring Guild / Scholarly Order","Headquarters":"The Neverending Library, Melphö","Current Level":"1 / 5","Member Title":"\"...the Celebrant\"","Benefit":"+1 Speed","Allied With":"The Scarlet Pyre (currently)"},
    content:`<p>The Amber Ceremony is one of Melphö's two primary institutions — a scholarly adventuring guild headquartered in the <strong>Neverending Library</strong>, one of the last great repositories of pre-Wyldgrowth knowledge on Qærn.</p>
<h2>History and Purpose</h2>
<p>The Amber Ceremony predates the Wyldgrowth. In the days when Melphö flourished as a city of mages and scholars, the Ceremony served as an order dedicated to the preservation, cataloguing, and pursuit of knowledge. Its members were archivists, researchers, and — when necessary — adventurers.</p>
<p>After the Wyldgrowth, the Ceremony's purpose shifted: preservation of what remained. The Neverending Library survived the chaos largely intact, and with it, the institutional knowledge of a vanished world.</p>
<h2>The Ceremony Today</h2>
<p>Following the Sixth Siege, the Amber Ceremony has set aside its long-standing rivalry with the Scarlet Pyre to pursue collaborative rebuilding of Melphö. Members carry their title as a suffix: <em>Maris the Celebrant</em>, or <em>Wulfric the Golden</em>.</p>
<h2>Known Ranks</h2>
<p><strong>Rank 1 — "...the Celebrant":</strong> +1 Speed<br/><strong>Rank 2 — "...the Ceremonious":</strong> +1 to skilled project rolls, +2 to unskilled<br/><strong>Rank 3 — "...the Golden":</strong> Gilded Squire retainer<br/><strong>Ranks 4–5:</strong> Unknown</p>`
  },
  "scarlet-pyre":{
    id:"scarlet-pyre",title:"The Scarlet Pyre",category:"Factions",
    subtitle:"Flame That Does Not Go Out",
    infobox:{"Type":"Adventuring Guild","Headquarters":"The Pyre, Melphö","Current Level":"1 / 5","Member Title":"\"...the Pyreling\"","Benefit":"+1 Stability","Allied With":"The Amber Ceremony (currently)"},
    content:`<p>The Scarlet Pyre is Melphö's oldest adventuring guild, named for the ceremonial flame that has burned within the city's walls for as long as anyone can remember. Where the Amber Ceremony pursues knowledge, the Scarlet Pyre pursues action — and has always been the sharper edge of Melphö's survival.</p>
<h2>History and Purpose</h2>
<p>The Scarlet Pyre was founded as a guild of heroes. Its flame is said to have been lit in the city's earliest days and has never been extinguished — not through siege, not through famine, not through the Wyldgrowth itself.</p>
<p>Pyrelings are fighters, scouts, and adventurers first. The guild operates on a simple philosophy: when something threatens Melphö, you go deal with it.</p>
<h2>The Pyre Today</h2>
<p>Like the Amber Ceremony, the Scarlet Pyre suffered significant losses in the Sixth Siege, and has reached across its old rivalry to collaborate on rebuilding. The alliance holds. For now.</p>
<h2>Known Ranks</h2>
<p><strong>Rank 1 — "...the Pyreling":</strong> +1 Stability<br/><strong>Rank 2 — "...the Pyre Keeper":</strong> Fire immunity 5<br/><strong>Rank 3 — "Pyre Knight":</strong> Ember Squire retainer<br/><strong>Ranks 4–5:</strong> Unknown</p>`
  },
  "the-peace-king":{
    id:"the-peace-king",title:"The Peace King",category:"Lore & History",
    subtitle:"God-Emperor of Qærn, Husband of the Earthmother",
    infobox:{"Also Known As":"The All-Powerful, God of Man","Former Title":"Immortal King of Hallan","Status":"Unknown (in chrysalis?)","Consort":"Qaern, the Earthmother","Act":"The Wyldgrowth (~100 years ago)","Worshipped By":"Most humans (unwillingly)"},
    content:`<p>The Peace King is the god-emperor responsible for the Wyldgrowth — the cataclysm that consumed Qærn one hundred years ago and from which the world has never recovered. Once revered as an immortal peacemaker and great king of Hallan, he is now largely feared and hated by those who know his true nature.</p>
<h2>Before Apotheosis</h2>
<p>The Peace King ruled Hallan as an immortal king, presiding over the Helenian Empire and an unprecedented era of peace. He was celebrated as a symbol of civilization's potential — proof that the feuding peoples of Qærn could coexist.</p>
<p>He was not what they believed him to be.</p>
<p>When the kingdom of Thelonia broke his armistice, the Peace King responded by <strong>expunging the Thelonians from existence en masse</strong> — not defeating them, not imprisoning them, but erasing them. The destitute survivors were left to bargain with ancient darkness for mere survival.</p>
<h2>The Wyldgrowth</h2>
<p>Viewing mankind as corrupted beyond redemption, the Peace King forced matrimony upon <strong>Qaern</strong>, the sleeping Earthmother, amplifying his divine power tenfold. From within a chrysalis, he unleashed the Wyldgrowth. Overnight: forests became impassable wastelands, oceans became coral jungles, plains vanished under vine and root.</p>
<h2>Present Status</h2>
<p>The Peace King has not been seen since entering his chrysalis. He may be sleeping, watching, or simply <em>present</em> — dissolved into the Wyldgrowth itself. Wyldmen serve his will without being commanded, suggesting something deeper than simple divine mandate.</p>
<p>Men worship him today not out of love, but because they were given no other option.</p>`
  },
  "hallenious-pantheon":{
    id:"hallenious-pantheon",title:"The Hallenious Pantheon",category:"Lore & History",
    subtitle:"The Gods of Men, Worshipped in Secret",
    infobox:{"Practiced By":"Men of Qærn","Status":"Officially suppressed; practiced privately","Saints":"Once thousands; none living confirmed","Greater Pantheon":"Eleven primary gods + the Peace King"},
    content:`<p>The Hallenious gods are the ancient gods of mankind — household deities worshipped from the safety of hearth and home, in the days when homes were places that creatures of vile darkness could not enter without express invitation.</p>
<p>Since the Peace King declared himself God of Man, the Hallenious faith has been officially discouraged, their names more often used as curses than prayers. But the gods themselves have not gone anywhere.</p>
<h2>The Greater Pantheon</h2>
<p><strong>Cast</strong> — <em>The Earthking</em> · King of the Gods, God of Reality<br/>
<strong>Ektia</strong> — <em>The Puress</em> · Queen of the Gods, God of Love<br/>
<strong>Kettle</strong> — <em>The Mindly</em> · Wise Prince/Princess, God of Knowledge<br/>
<strong>Cotul</strong> — <em>The Settler</em> · Warchief, God of Conquest<br/>
<strong>Iionios</strong> — <em>The Weaver</em> · Mage of Mages, God of Magic<br/>
<strong>Sun</strong> — <em>The Starryeyed</em> · Night and Day, God of Time<br/>
<strong>Qaern</strong> — <em>The Earthmother</em> · The Earth, God of Nature<br/>
<strong>Avos</strong> — <em>The Lifebreather</em> · God-Counselor, God of Medicine<br/>
<strong>End</strong> — <em>The Quiet King</em> · Gravekeeper, God of Death<br/>
<strong>Museus</strong> — <em>The Keeper</em> · Curator, God of Art<br/>
<strong>Tyran</strong> — <em>The Tidebringer</em> · Duke of the Seas, God of the Ocean<br/>
<strong>The Peace King</strong> — <em>The All-Powerful</em> · God-Emperor, God of Man</p>
<h2>Minor Gods</h2>
<p>Beyond the Greater Pantheon, the Hallenious tradition contains hundreds of minor gods — most known only to scholars. Notable examples include <strong>Lakrodekt, Venom Lord</strong> (God of Spiders); <strong>Efevresi, the Forge Master</strong> (God of Invention); and <strong>Juras</strong> and <strong>Entrus</strong>, the Gods of Chaos and Law respectively.</p>
<h2>Saints</h2>
<p>The gods communicated with mankind through <strong>saints</strong> — mortal pseudo-avatars, defined by their untimely, miserable, or torturous deaths. In life, saints could bestow miracles. In death, they can still be bargained with, beseeched, and in extraordinarily rare cases, summoned by their most devout followers.</p>
<p>Since the Wyldgrowth, no living saint has been confirmed anywhere in Qærn. The dead ones, at least, are not going anywhere.</p>`
  },
}
