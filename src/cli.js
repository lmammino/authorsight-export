#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import cliProgress from 'cli-progress'
import { Command } from 'commander'
import dayjs from 'dayjs'
import { parse } from 'node-html-parser'
import { CookieJar } from 'tough-cookie'
import { DATA_TYPES } from './data.js'

async function getVersionFromPkg() {
  const pkg = await JSON.parse(
    await readFile(join(import.meta.dirname, '../package.json'), 'utf-8'),
  )
  return pkg.version
}

const VERSION = await getVersionFromPkg()
const supportedDataTypes = DATA_TYPES.map((t) => t.type)

const program = new Command()

program
  .name('packt-sales-fetcher')
  .description(
    'Fetch Kindle and Print sales from Packt Author portal and export in Hive format',
  )
  .version(VERSION)
  .option('-s, --session <cookie>', 'Packt authorsight_session cookie')
  .option(
    '-o, --output <directory>',
    'Output directory for Hive-style data files',
    '.',
  )
  .option(
    '-b, --books <bookIds>',
    'Comma-separated list of book IDs to fetch (if empty, fetches all books)',
    (val) => val.split(',').map((id) => id.trim().toUpperCase()),
  )
  .option(
    '-t, --types <types>',
    `Comma-separated list of data types to fetch. Supported values: ${supportedDataTypes.join(
      ',',
    )}. Default: all`,
    (val) =>
      val
        .split(',')
        .map((t) => t.trim())
        .filter((t) => supportedDataTypes.includes(t)),
    supportedDataTypes,
  )
  .parse(process.argv)

const options = program.opts()
const authorsightSession = options.session || process.env.AUTHORSIGHT_SESSION
const outputDir = resolve(options.output)
const selectedDataTypes = DATA_TYPES.filter((t) =>
  options.types.includes(t.type),
)

if (!authorsightSession) {
  console.error('\n❌ Error: Missing authorsight_session.')
  console.error(
    'Provide it using:\n  - the --session option\n  - or the AUTHORSIGHT_SESSION environment variable.\n',
  )
  program.help({ error: true })
}

function* getYearMonthRange(publishDate) {
  const start = dayjs(publishDate)
  const end = dayjs()
  let current = start.startOf('month')
  while (current.isBefore(end)) {
    yield { year: current.year(), month: current.month() + 1 }
    current = current.add(1, 'month')
  }
}

async function fetchSales(bookId, year, month, client, type, retries = 5) {
  const { endpoint, granularity } = DATA_TYPES.find((t) => t.type === type)

  const url =
    granularity === 'yearly'
      ? `https://authors.packt.com/graph-data/${endpoint}/${bookId}/${year}`
      : `https://authors.packt.com/graph-data/${endpoint}/${bookId}/${year}/${month}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.get(url, {
        headers: { Accept: 'application/json' },
      })
      return response.data
    } catch (err) {
      const status = err.response?.status
      const isRetriable = status >= 500 && status < 600
      if (attempt === retries || !isRetriable) throw err
      const waitTime = 500 * 2 ** attempt
      await delay(waitTime)
    }
  }
}

async function discoverBooks(client) {
  const response = await client.get(
    'https://authors.packt.com/reports/published',
  )
  const html = parse(response.data)
  const rows = html.querySelectorAll('#datatable-publish-table tbody tr')

  return rows
    .map((row) => {
      const onclick = row.getAttribute('onclick')
      const bookIdMatch = onclick.match(/published\/([A-Z0-9]+)/)
      const bookId = bookIdMatch ? bookIdMatch[1] : null

      const titleEl = row.querySelector('td[data-title="Title"] span.content')
      const title = titleEl?.text.trim()

      const dateEl = row.querySelector(
        'td[data-title="Published on"] span.content',
      )
      const date = dayjs(dateEl?.text.trim(), 'DD MMMM, YYYY').format(
        'YYYY-MM-DD',
      )

      return { id: bookId, title, publishDate: date }
    })
    .filter((book) => book.id && book.title && book.publishDate)
}

// normalizes a timestamp in the format "1st Jan, 2023" to "YYYY-MM-DD"
function normalizeLabel(label) {
  return dayjs(
    label.replace(/^(\d+)(st|nd|rd|th)/, '$1'),
    'D MMM, YYYY',
  ).format('YYYY-MM-DD')
}

function normalizeLabelsInData(data) {
  if (!data || !data.labels) return data
  const normalizedLabels = data.labels.map((label) => normalizeLabel(label))
  return {
    ...data,
    labels: normalizedLabels,
  }
}

async function saveData(type, bookId, year, month, data) {
  const { csvFields, granularity } = DATA_TYPES.find((t) => t.type === type)
  const base = [outputDir, `${type}`, `book=${bookId}`, `year=${year}`]
  if (granularity === 'monthly') {
    base.push(`month=${String(month).padStart(2, '0')}`)
  }

  const dir = join(...base)
  await mkdir(dir, { recursive: true })

  const jsonPath = join(dir, 'data.json')
  const jsonData = granularity === 'yearly' ? data : normalizeLabelsInData(data)
  await writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8')

  const headers = ['date', ...csvFields]
  const lines = data.labels.map((label, index) => {
    const date =
      granularity === 'yearly'
        ? label // Use "January", "February", etc.
        : normalizeLabel(label)

    const values = csvFields.map((f) => data.data[f]?.[index] ?? 0)
    return `"${date}",${values.join(',')}`
  })

  const csvPath = join(dir, 'data.csv')
  const csvContent = [headers.join(','), ...lines].join('\n')
  await writeFile(csvPath, csvContent, 'utf-8')
}

if (!existsSync(outputDir)) {
  await mkdir(outputDir, { recursive: true })
}

const jar = new CookieJar()
jar.setCookieSync(
  `authorsight_session=${authorsightSession}`,
  'https://authors.packt.com',
)
const client = wrapper(axios.create({ jar, withCredentials: true }))

const books = await discoverBooks(client)
console.log(`📚 Discovered ${books.length} books`)

const filteredBooks = options.books
  ? books.filter((b) => options.books.includes(b.id))
  : books

const tasks = []
for (const { type, granularity } of selectedDataTypes) {
  for (const book of filteredBooks) {
    if (granularity === 'monthly') {
      for (const { year, month } of getYearMonthRange(book.publishDate)) {
        tasks.push({ book, type, year, month })
      }
    } else if (granularity === 'yearly') {
      const startYear = dayjs(book.publishDate).year()
      const currentYear = dayjs().year()
      for (let year = startYear; year <= currentYear; year++) {
        tasks.push({ book, type, year })
      }
    }
  }
}

const progress = new cliProgress.SingleBar(
  {
    format: '📦 Download |{bar}| {percentage}% | {value}/{total} requests',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
  },
  cliProgress.Presets.shades_classic,
)

progress.start(tasks.length, 0)

const totalsByBook = {}

for (const task of tasks) {
  const { book, year, month, type } = task
  try {
    const data = await fetchSales(book.id, year, month, client, type)
    await saveData(type, book.id, year, month, data)

    if (!totalsByBook[book.id]) {
      totalsByBook[book.id] = {
        title: book.title,
        print: 0,
        digital: 0,
        kindle: 0,
      }
    }

    const { totalKeys } = DATA_TYPES.find((t) => t.type === type)
    totalsByBook[book.id].print += data.data[totalKeys[0]] || 0
    if (type === 'amazon_daily') {
      totalsByBook[book.id].kindle += data.data[totalKeys[1]] || 0
    } else if (type === 'direct_daily') {
      totalsByBook[book.id].digital += data.data[totalKeys[1]] || 0
    }
  } catch (err) {
    console.error(
      `❌ Error for ${type} ${book.id} ${year}-${String(month).padStart(2, '0')}: ${err.message}`,
    )
  }
  progress.increment()
}

progress.stop()

console.log('\n📊 Sales Summary')
for (const [id, summary] of Object.entries(totalsByBook)) {
  console.log(
    ` - ${summary.title} (${id}): Print=${summary.print}, Kindle=${summary.kindle}`,
  )
}
