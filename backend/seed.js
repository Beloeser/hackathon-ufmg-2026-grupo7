import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from './src/config/db.js'
import User from './src/models/UserModel.js'
import Case from './src/models/CaseModel.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROCESSOS_EM_ANDAMENTO_CSV = path.resolve(
  __dirname,
  '..',
  'db',
  'processed',
  'processos_em_andamento.csv'
)

const sampleUsers = [
  {
    email: 'maria.silva@coffeebreakers.local',
    password: 'senha123',
    name: 'Maria Silva',
    role: 'advogado',
  },
  {
    email: 'joao.santos@coffeebreakers.local',
    password: 'adv2024',
    name: 'Joao Santos',
    role: 'advogado',
  },
  {
    email: 'ana.costa@coffeebreakers.local',
    password: 'demo456',
    name: 'Ana Costa',
    role: 'admin',
  },
]

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function toNumberOrZero(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return 0
  }

  const commaIndex = raw.lastIndexOf(',')
  const dotIndex = raw.lastIndexOf('.')

  let normalized = raw

  if (commaIndex > dotIndex) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = raw.replace(/,/g, '')
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStatusLabel(value) {
  const text = String(value || '').trim()
  return text || 'Em andamento'
}

function inferActionClass(subject, subSubject) {
  const merged = `${String(subject || '')} ${String(subSubject || '')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (merged.includes('bancario') || merged.includes('juros abusivos') || merged.includes('revisional')) {
    return 'revisional_bancaria'
  }

  if (merged.includes('dano moral') || merged.includes('indeniz') || merged.includes('responsabilidade civil')) {
    return 'indenizatoria'
  }

  if (merged.includes('execucao fiscal') || merged.includes('cobranca') || merged.includes('recuperacao de credito')) {
    return 'cobranca'
  }

  return 'geral'
}

async function loadSampleCasesFromCsv() {
  const raw = await fs.readFile(PROCESSOS_EM_ANDAMENTO_CSV, 'utf8')
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return []
  }

  const rawHeaders = parseCsvLine(lines[0].replace(/^\uFEFF/, ''))
  const headers = rawHeaders.map((header) => normalizeHeader(header))

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const record = {}

    headers.forEach((header, index) => {
      record[header] = String(values[index] ?? '').trim()
    })

    return record
  })

  return rows
    .map((row) => {
      const processNumber = String(row.numero_do_processo || row.numero_processo || '').trim()
      const uf = String(row.uf || '').trim().toUpperCase()
      const subject = String(row.assunto || '').trim()
      const subSubject = String(row.sub_assunto || '').trim()

      if (!processNumber || !uf || !subject) {
        return null
      }

      const macroResult = String(row.resultado_macro || 'Em andamento').trim() || 'Em andamento'
      const microResult = String(row.resultado_micro || macroResult).trim() || macroResult
      const statusLabel = normalizeStatusLabel(microResult || macroResult)

      return {
        processNumber,
        uf,
        subject,
        subSubject,
        macroResult,
        microResult,
        claimValue: toNumberOrZero(row.valor_da_causa),
        condemnationValue: toNumberOrZero(row.valor_da_condenacao_indenizacao),
        status: statusLabel,
        internalStatus: statusLabel,
        judicialStatus: 'nao_confirmado',
        judicialPhase: 'fase processual nao confirmada',
        actionClass: inferActionClass(subject, subSubject),
        clientRole: 'autor',
      }
    })
    .filter(Boolean)
}

async function ensureSampleUsers() {
  const users = []

  for (const userData of sampleUsers) {
    const email = String(userData.email || '').trim().toLowerCase()
    let user = await User.findOne({ email })

    if (!user) {
      user = await User.create({ ...userData, email })
      console.log(`Usuario criado: ${user.email}`)
    }

    users.push(user)
  }

  return users
}

const runSeed = async () => {
  await connectDB()

  const sampleCases = await loadSampleCasesFromCsv()
  if (sampleCases.length === 0) {
    throw new Error(`Nenhum processo encontrado em ${PROCESSOS_EM_ANDAMENTO_CSV}.`)
  }

  const users = await ensureSampleUsers()
  if (users.length === 0) {
    throw new Error('Nenhum usuario disponivel para vincular os processos do seed.')
  }

  await Case.deleteMany({})
  console.log('Colecao de processos limpa para recarga do CSV.')

  const now = Date.now()
  const casesToInsert = sampleCases.map((caseData, index) => ({
    ...caseData,
    assignedLawyerId: users[index % users.length]._id,
    createdAt: new Date(now - index * 60000),
    updatedAt: new Date(now - index * 60000),
  }))

  const inserted = await Case.insertMany(casesToInsert, { ordered: true })

  console.log(`Processos carregados do CSV: ${sampleCases.length}`)
  console.log(`Processos inseridos no Mongo: ${inserted.length}`)
  console.log('Seed finalizada com sucesso.')
  process.exit(0)
}

runSeed().catch((error) => {
  console.error('Falha ao executar seed:', error)
  process.exit(1)
})
