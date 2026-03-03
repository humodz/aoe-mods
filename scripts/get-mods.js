import { readFileSync, writeFileSync } from 'node:fs'
import pick from 'lodash/pick.js'

const cookie = readFileSync('cookie.txt', 'utf-8')

async function main() {
  const args = process.argv.slice(2)

  const gameWanted = args.length
    ? game => args.some(it => game.id === +it)
    : () => true

  const games = [
    { name: 'AoE:DE', id: 1, path: 'mods/aoede.json' },
    { name: 'AoE2:DE', id: 2, path: 'mods/aoe2de.json' },
    { name: 'AoE3:DE', id: 3, path: 'mods/aoe3de.json' },
    { name: 'AoE4', id: 4, path: 'mods/aoe4.json' },
    { name: 'AoM:R', id: 1001, path: 'mods/aomr.json' },
  ]

  const wantedGames = games.filter(gameWanted)
  console.log(`Games: ${wantedGames.map(it => it.name).join(' ')}`)

  for (const game of wantedGames) {
    console.log('Downloading mods for ' + game.name)
    const modsOriginal = await getAllMods(game)
    const modsDeduped = dedupe(modsOriginal, mod => mod.modId)
    const modsTidy = modsDeduped.map(mod => pick(mod, wantedProps))
    modsTidy.sort((a, b) => a.modId - b.modId)

    writeFileSync(game.path, JSON.stringify(modsTidy, null, 2))
  }

  writeFileSync('mods/last-update.json', JSON.stringify({ date: new Date().toISOString() }))
}

async function getMods(body) {
  const res = await fetch('https://api.ageofempires.com/api/v4/mods/Find', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { cookie },
  })

  if (!res.ok) {
    writeFileSync('error.txt', await res.text().catch((e) => e.message))
    throw new Error('Request failed with status ' + res.status)
  }

  return await res.json()
}

async function getAllMods(game) {
  const req = {
    start: 1,
    count: 200,
    q: '',
    game: game.id,
    modid: 0,
    filter: 0,
    status: '',
    tags: [],
    sort: 'lastUpdate',
    order: 'DESC',
  }

  const pages = []
  let totalMods = null
  let totalPages = null
  let i = 0

  while (true) {
    i += 1
    process.stdout.write(`\r[${game.name}] page ${i}${totalPages ? ` of ${totalPages}` : ''}${totalMods ? ` (total: ${totalMods})` : ''}`)
    const res = await getMods({ ...req, start: i })
    totalMods = res.totalCount
    totalPages = Math.ceil((totalMods / req.count + 1))

    if (res.modList.length === 0) {
      break
    }
    pages.push(res.modList)
  }
  console.log('')

  return pages.flat()
}

function dedupe(mods, keyFn) {
  const map = new Map(mods.map(it => [keyFn(it), it]))
  return [...map.values()]
}

const wantedProps = [
  'modId',
  'modName',
  'description',
  'modVersion',
  'modType',
  'modTags',
  'creatorName',
  'creatorAvatarUrl',
  'createDate',
  'lastUpdate',
  'modFileSize',
  'popular',
  'downloads',
  'installs',
  'likes',
  'ratings.rating.average',
  'ratings.rating.totalCount',
  'thumbnail',
]

await main()