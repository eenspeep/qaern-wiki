import { useState, useMemo, useRef, useEffect } from 'react'

// Full emoji dataset organised by category
// Each entry: [emoji, search keywords]
const EMOJI_DATA = {
  'Nature': [
    ['🌲','tree pine evergreen forest'],['🌳','tree deciduous park'],['🌴','palm tree tropical'],
    ['🌵','cactus desert'],['🌾','sheaf wheat grass field'],['🍀','clover lucky'],
    ['🌿','herb green plant'],['🍃','leaves nature'],['🍂','fallen leaf autumn'],
    ['🍁','maple leaf autumn canada'],['🌱','seedling sprout'],['🌻','sunflower'],
    ['🌹','rose flower'],['🌺','hibiscus flower tropical'],['🌸','cherry blossom'],
    ['🌼','blossom flower'],['🌷','tulip flower'],['💐','bouquet flowers'],
    ['🍄','mushroom fungi'],['🌊','wave water ocean sea'],['🔥','fire flame'],
    ['❄','snowflake ice cold winter'],['⛄','snowman winter'],['🌨','snow cloud'],
    ['🌧','rain cloud'],['⛈','thunder storm lightning'],['🌩','lightning bolt'],
    ['🌫','fog mist'],['🌪','tornado twister wind'],['🌈','rainbow'],
    ['☀','sun sunny clear'],['🌙','moon crescent night'],['🌕','full moon'],
    ['🌑','new moon dark'],['⭐','star'],['🌟','glowing star'],['✨','sparkles magic'],
    ['☁','cloud'],['⛅','partly cloudy'],['🌋','volcano eruption mountain'],
    ['⛰','mountain peak'],['🏔','snow capped mountain'],['🗻','mount fuji'],
    ['🏕','camping tent'],['🏜','desert sand'],['🏝','island tropical'],
    ['🏞','national park landscape'],['🌄','sunrise mountain'],['🌅','sunrise'],
    ['🌠','shooting star night'],['🌌','milky way galaxy'],
  ],
  'Creatures': [
    ['🐉','dragon fantasy'],['🦄','unicorn fantasy magic'],['🐲','dragon face'],
    ['🦅','eagle bird raptor sky'],['🦆','duck bird water'],['🦉','owl bird wise night'],
    ['🦋','butterfly insect'],['🐺','wolf howl predator'],['🦊','fox cunning'],
    ['🐻','bear animal'],['🐗','boar pig wild'],['🦌','deer stag antler'],
    ['🐴','horse steed mount'],['🦌','deer'],['🐑','sheep wool'],
    ['🐄','cow cattle'],['🐖','pig swine'],['🐓','rooster chicken'],
    ['🦆','duck'],['🦅','eagle'],['🦜','parrot bird'],['🦢','swan bird elegant'],
    ['🦩','flamingo pink bird'],['🕊','dove peace bird white'],['🦅','eagle'],
    ['🐍','snake serpent'],['🦎','lizard reptile'],['🐊','crocodile alligator'],
    ['🐢','turtle tortoise slow'],['🦕','dinosaur sauropod'],['🦖','t-rex dinosaur'],
    ['🦈','shark ocean predator'],['🐬','dolphin ocean smart'],['🐳','whale ocean big'],
    ['🐋','whale ocean'],['🦑','squid ocean tentacle'],['🦀','crab ocean'],
    ['🦞','lobster ocean'],['🦂','scorpion venom danger'],['🕷','spider web creepy'],
    ['🐛','bug caterpillar worm'],['🐜','ant insect'],['🐝','bee honey insect'],
    ['🦟','mosquito insect'],['🦗','cricket insect'],['🦠','microbe germ'],
    ['🐾','paw print tracks animal'],
  ],
  'People & Roles': [
    ['👤','person silhouette npc'],['👥','people group crowd'],['🧙','mage wizard sorcerer'],
    ['🧝','elf fantasy'],['🧟','zombie undead'],['🧛','vampire undead'],
    ['🧜','mermaid water fantasy'],['🧚','fairy magic fantasy'],['🧞','genie magic'],
    ['🧝','elf'],['👑','crown king queen royalty'],['🤺','fencing sword duel'],
    ['🏹','archer bow arrow ranger'],['⚔','crossed swords battle war'],
    ['🛡','shield defense guard'],['💂','guard soldier'],['🕵','detective spy'],
    ['👁','eye watch spy'],['🧑‍🌾','farmer'],['🧑‍🍳','cook chef'],
    ['💀','skull death dead danger'],['☠','skull crossbones poison death'],
    ['👻','ghost spirit spooky'],['💩','poop'],
  ],
  'Objects & Items': [
    ['⚔','swords crossed battle'],['🗡','dagger blade weapon'],['🔪','knife blade'],
    ['🏹','bow arrow archery'],['🛡','shield defense'],['⚙','gear mechanism'],
    ['🔧','wrench tool'],['🔨','hammer tool'],['⛏','pickaxe mining'],
    ['⚒','hammer pick tools'],['🪓','axe chop'],['🗝','key old lock'],
    ['🔑','key lock'],['🔒','locked secure'],['🔓','unlocked open'],
    ['🔮','crystal ball magic'],['🧿','nazar evil eye amulet'],
    ['📜','scroll document ancient'],['📖','book open reading'],['📚','books library'],
    ['🗺','map world exploration'],['🧭','compass direction navigation'],
    ['⚗','alembic potion alchemy'],['🧪','test tube potion experiment'],
    ['💉','syringe potion medicine'],['🧲','magnet attraction'],
    ['💎','gem diamond treasure'],['💰','money bag gold treasure'],
    ['🏆','trophy victory'],['🎖','medal award'],['🎭','masks theater'],
    ['🎲','dice random game'],['🃏','card joker'],['🎯','target bullseye'],
    ['🕯','candle light flame'],['🪔','lamp light oil'],['🔦','flashlight torch'],
    ['🏮','lantern red light'],['💡','light idea'],['🔔','bell ring alert'],
    ['🪄','wand magic spell'],['🧸','bear toy'],['🪆','doll nested'],
    ['🪬','amulet ward protection'],['🧨','firecracker explosive'],
    ['💣','bomb explosion danger'],['🪤','trap'],
  ],
  'Places & Structures': [
    ['🏰','castle fortress medieval'],['🏯','japanese castle'],['🗼','tower structure'],
    ['🏠','house home village'],['🏡','house garden home'],['🏚','abandoned house ruin'],
    ['🏛','classical building temple pillars'],['⛪','church chapel'],
    ['🕌','mosque'],['🕍','synagogue'],['⛩','shinto shrine gate'],
    ['🛖','hut shelter primitive'],['⛺','tent camp shelter'],['🏕','camping'],
    ['🚪','door entrance exit'],['🪟','window'],['🏗','construction building'],
    ['🏘','houses village'],['🌆','city buildings urban'],['🌃','night city'],
    ['🗽','statue liberty monument'],['🗿','moai stone statue'],
    ['⛲','fountain water park'],['⛱','umbrella beach'],['🎠','carousel amusement'],
    ['🎡','ferris wheel amusement'],['🎪','circus tent'],
  ],
  'Travel & Transport': [
    ['🛤','railway track road path'],['🛣','highway road'],['⚓','anchor harbor port'],
    ['⛵','sailboat water travel'],['🚢','ship ocean travel'],['⛴','ferry boat'],
    ['🚤','speedboat water'],['⛽','fuel station'],['🗺','map navigation'],
    ['🧭','compass direction'],['🛶','canoe boat'],['🪂','parachute sky'],
    ['🏇','horse race riding'],['🛕','temple travel'],
  ],
  'Symbols & Signs': [
    ['❓','question unknown mystery'],['❗','exclamation alert warning'],
    ['⚠','warning danger caution'],['☢','radioactive hazard'],['☣','biohazard danger'],
    ['⛔','no entry forbidden stop'],['🚫','prohibited forbidden'],
    ['✅','check ok confirmed'],['❌','cross wrong denied'],['💯','hundred perfect score'],
    ['🔴','red circle danger'],['🟠','orange circle'],['🟡','yellow circle caution'],
    ['🟢','green circle safe'],['🔵','blue circle water'],['🟣','purple circle magic'],
    ['⚫','black circle dark'],['⚪','white circle light'],
    ['🔶','orange diamond'],['🔷','blue diamond water'],['💠','diamond blue water'],
    ['♾','infinity loop eternal'],['⚜','fleur de lis noble'],['🔱','trident sea'],
    ['☯','yin yang balance'],['✡','star david'],['☮','peace sign'],
    ['⚡','lightning bolt electric fast'],['💥','explosion boom impact'],
    ['💫','dizzy star magic'],['🌀','cyclone spiral swirl'],
    ['🔰','beginner green yellow'],['♻','recycle loop'],['🏳','white flag'],
    ['🏴','black flag pirate'],['🚩','flag red marker warning'],
    ['🗺','map world exploration marker'],['📍','pin location marker red'],
    ['📌','pushpin marker location'],['🔖','bookmark saved'],
  ],
  'Food & Nature': [
    ['🍎','apple red fruit'],['🍊','orange citrus fruit'],['🍋','lemon sour yellow'],
    ['🍇','grapes wine fruit'],['🍓','strawberry red berry'],['🫐','blueberry'],
    ['🍒','cherries red fruit'],['🥕','carrot vegetable orange'],
    ['🌽','corn maize yellow grain'],['🧅','onion vegetable'],
    ['🍖','meat bone food'],['🍗','chicken leg food'],['🥩','meat steak food'],
    ['🍞','bread food'],['🍺','beer mug drink tavern'],['🍻','cheers beer drink'],
    ['🍷','wine drink red'],['🥃','whiskey drink glass'],['🫖','teapot drink'],
    ['☕','coffee hot drink'],['🍵','tea hot drink cup'],
  ],
  'Weather & Sky': [
    ['☀','sun sunny bright'],['🌤','sun small cloud'],['⛅','partly cloudy'],
    ['🌥','cloudy overcast'],['☁','cloud grey'],['🌦','rain sun'],
    ['🌧','rain cloud wet'],['⛈','thunder storm'],['🌩','lightning storm'],
    ['🌨','snow cloud winter'],['❄','snowflake cold winter ice'],
    ['🌬','wind blowing air'],['🌪','tornado twister'],['🌫','fog mist grey'],
    ['🌈','rainbow colorful'],['☔','umbrella rain'],['⛱','umbrella sun beach'],
    ['☄','comet meteor space'],['🌙','moon night crescent'],['🌛','moon face'],
    ['🌝','full moon face'],['🌕','full moon bright'],['🌑','new moon dark'],
    ['⭐','star bright'],['🌟','star glowing special'],['💫','star dizzy magic'],
    ['✨','sparkle magic shine'],['🌠','shooting star wish'],
  ],
}

const ALL_EMOJI = Object.entries(EMOJI_DATA).flatMap(([cat, items]) =>
  items.map(([emoji, keywords]) => ({ emoji, keywords, cat }))
)

export default function EmojiPicker({ value, onChange, disabled }) {
  const [search, setSearch] = useState('')
  const [activecat, setActiveCat] = useState('Nature')
  const [open, setOpen] = useState(false)
  const pickerRef = useRef(null)
  const searchRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  const results = useMemo(() => {
    if (!search.trim()) return EMOJI_DATA[activecat] || []
    const q = search.toLowerCase()
    return ALL_EMOJI
      .filter(e => e.emoji.includes(q) || e.keywords.includes(q) ||
        e.keywords.split(' ').some(w => w.startsWith(q)))
      .map(e => [e.emoji, e.keywords])
      .slice(0, 80)
  }, [search, activecat])

  const select = (em) => {
    onChange(em)
    setOpen(false)
    setSearch('')
  }

  const cellStyle = (em) => ({
    width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, cursor: 'pointer', fontSize: '1.1rem',
    fontFamily: "'Noto Emoji', sans-serif",
    border: `1px solid ${value === em ? '#1b4f72' : 'transparent'}`,
    background: value === em ? '#e8f0f8' : 'transparent',
    transition: 'background 0.1s',
  })

  return (
    <div style={{ position: 'relative', marginBottom: 10 }} ref={pickerRef}>
      {/* Trigger row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div onClick={() => !disabled && setOpen(o => !o)}
          style={{ width: 40, height: 40, border: '1px solid #ccc9c0', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', background: '#f8f7f4', flexShrink: 0,
            fontFamily: "'Noto Emoji', sans-serif",
            cursor: disabled ? 'default' : 'pointer' }}>
          {value && value !== '○' ? value : '○'}
        </div>
        <div style={{ flex: 1, fontSize: '0.78rem', color: '#888', fontStyle: 'italic' }}>
          {disabled ? 'Read only' : value && value !== '○' ? 'Click to change marker' : 'Click to pick a marker'}
        </div>
        {!disabled && value && value !== '○' && (
          <button onClick={() => onChange('○')}
            style={{ padding: '3px 8px', border: '1px solid #e0ddd8', borderRadius: 3,
              background: '#f8f7f4', cursor: 'pointer', fontSize: '0.7rem', color: '#aaa' }}>
            Clear
          </button>
        )}
      </div>

      {/* Picker dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: 46, left: 0, zIndex: 200,
          width: 300, background: '#fdf8f0', border: '1px solid #ccc9c0',
          borderRadius: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Search */}
          <div style={{ padding: '8px 8px 4px' }}>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder='Search emoji…'
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #ccc9c0',
                borderRadius: 4, fontSize: '0.82rem',
                fontFamily: "'Source Serif 4', Georgia, serif",
                background: '#f8f7f4', color: '#222', boxSizing: 'border-box' }}/>
          </div>

          {/* Category tabs — hidden when searching */}
          {!search && (
            <div style={{ display: 'flex', overflowX: 'auto', padding: '2px 4px',
              borderBottom: '1px solid #e8e5e0', gap: 1, flexShrink: 0 }}>
              {Object.keys(EMOJI_DATA).map(cat => (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  style={{ padding: '3px 7px', border: 'none', borderRadius: 3,
                    background: activecat === cat ? '#1b4f72' : 'transparent',
                    color: activecat === cat ? '#fff' : '#888',
                    cursor: 'pointer', fontSize: '0.62rem', whiteSpace: 'nowrap',
                    fontFamily: "'Source Serif 4', Georgia, serif" }}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Emoji grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', padding: '6px',
            maxHeight: 200, overflowY: 'auto', gap: 1 }}>
            {results.length === 0 && (
              <div style={{ width: '100%', padding: '12px', textAlign: 'center',
                color: '#aaa', fontSize: '0.78rem', fontStyle: 'italic' }}>
                No emoji found
              </div>
            )}
            {results.map(([em, kw]) => (
              <div key={em} title={kw.split(' ')[0]}
                onClick={() => select(em)}
                style={cellStyle(em)}
                onMouseEnter={e => { if (value !== em) e.currentTarget.style.background = '#f0eeea' }}
                onMouseLeave={e => { if (value !== em) e.currentTarget.style.background = 'transparent' }}>
                {em}
              </div>
            ))}
          </div>

          {search && (
            <div style={{ padding: '4px 8px 6px', fontSize: '0.65rem', color: '#bbb',
              borderTop: '1px solid #e8e5e0' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
