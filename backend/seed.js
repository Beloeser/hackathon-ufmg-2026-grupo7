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

const LEGACY_SAMPLE_PROCESS_NUMBERS = [
  '1764352-89.2025.8.06.1818',
  '1764353-90.2025.8.05.0001',
  '1764354-01.2025.8.07.0002',
  '1764355-12.2025.8.26.0003',
  '1764356-23.2025.8.16.0004',
]

const EXTRA_SAMPLE_CASES = [
  {
    processNumber: '5001200-11.2026.8.26.0100',
    uf: 'SP',
    subject: 'Execucao fiscal',
    subSubject: 'ICMS',
    macroResult: 'Em andamento',
    microResult: 'Analise documental',
    claimValue: 185000,
    condemnationValue: 124000,
    status: 'em_andamento',
    internalStatus: 'em_analise',
    judicialStatus: 'nao_confirmado',
    judicialPhase: 'citacao pendente',
    actionClass: 'cobranca',
    clientRole: 'reu',
    suggestedThesis: 'prescricao intercorrente e excesso de execucao',
  },
  {
    processNumber: '3004501-67.2026.8.19.0001',
    uf: 'RJ',
    subject: 'Responsabilidade civil',
    subSubject: 'Dano moral',
    macroResult: 'Em andamento',
    microResult: 'Audiencia designada',
    claimValue: 60000,
    condemnationValue: 25000,
    status: 'em_andamento',
    internalStatus: 'aguardando_audiencia',
    judicialStatus: 'nao_confirmado',
    judicialPhase: 'instrucao',
    actionClass: 'indenizatoria',
    clientRole: 'reu',
    suggestedThesis: 'inexistencia de ato ilicito e ausencia de nexo causal',
  },
  {
    processNumber: '7003322-54.2026.8.05.0001',
    uf: 'BA',
    subject: 'Direito do consumidor',
    subSubject: 'Cobranca indevida',
    macroResult: 'Em andamento',
    microResult: 'Contestacao apresentada',
    claimValue: 12000,
    condemnationValue: 6500,
    status: 'em_andamento',
    internalStatus: 'em_analise',
    judicialStatus: 'nao_confirmado',
    judicialPhase: 'contestacao apresentada',
    actionClass: 'indenizatoria',
    clientRole: 'reu',
    suggestedThesis: 'regularidade da cobranca e boa-fe objetiva',
  },
  {
    processNumber: '8102201-09.2026.8.13.0001',
    uf: 'MG',
    subject: 'Trabalhista',
    subSubject: 'Verbas rescisorias',
    macroResult: 'Em andamento',
    microResult: 'Provas em producao',
    claimValue: 98000,
    condemnationValue: 41000,
    status: 'em_andamento',
    internalStatus: 'em_analise',
    judicialStatus: 'nao_confirmado',
    judicialPhase: 'instrucao',
    actionClass: 'geral',
    clientRole: 'reu',
    suggestedThesis: 'quitacao e adimplemento regular de verbas',
  },
]

const PROCESS_NUMBER_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
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
  const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function inferActionClass(subject, subSubject) {
  const merged = `${subject || ''} ${subSubject || ''}`.toLowerCase()

  if (merged.includes('bancario') || merged.includes('juros')) {
    return 'revisional_bancaria'
  }

  if (merged.includes('fiscal') || merged.includes('execucao') || merged.includes('cobranca')) {
    return 'cobranca'
  }

  if (merged.includes('indeniz') || merged.includes('dano')) {
    return 'indenizatoria'
  }

  return 'geral'
}

function parseCsvRecords(rawCsv) {
  const lines = rawCsv.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return []
  }

  const headers = parseCsvLine(lines[0].replace(/^\uFEFF/, '')).map(normalizeHeader)

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const record = {}

    headers.forEach((header, index) => {
      record[header] = String(values[index] ?? '').trim()
    })

    return record
  })
}

function buildCaseFromCsvRow(row) {
  const processNumber = String(row.numero_do_processo || '').trim()
  const uf = String(row.uf || '').trim().toUpperCase()
  const subject = String(row.assunto || '').trim()
  const subSubject = String(row.sub_assunto || '').trim()

  if (!PROCESS_NUMBER_REGEX.test(processNumber) || !uf || !subject) {
    return null
  }

  const actionClass = inferActionClass(subject, subSubject)

  return {
    processNumber,
    uf,
    subject,
    subSubject,
    macroResult: String(row.resultado_macro || 'Em andamento').trim(),
    microResult: String(row.resultado_micro || 'Em andamento').trim(),
    claimValue: toNumberOrZero(row.valor_da_causa),
    condemnationValue: toNumberOrZero(row.valor_da_condenacao_indenizacao),
    status: 'em_andamento',
    internalStatus: 'em_analise',
    judicialStatus: 'nao_confirmado',
    judicialPhase: 'fase processual nao confirmada',
    actionClass,
    clientRole: 'autor',
  }
}

async function loadSampleCasesFromCsv() {
  const rawCsv = await fs.readFile(PROCESSOS_EM_ANDAMENTO_CSV, 'utf8')
  const rows = parseCsvRecords(rawCsv)
  return rows.map(buildCaseFromCsvRow).filter(Boolean)
}

function dedupeCasesByProcessNumber(cases) {
  const seen = new Set()
  const deduped = []

  for (const caseData of cases) {
    const processNumber = String(caseData?.processNumber || '').trim()
    if (!processNumber || seen.has(processNumber)) {
      continue
    }

    seen.add(processNumber)
    deduped.push(caseData)
  }

  return deduped
}

const runSeed = async () => {
  await connectDB()

  const csvCases = await loadSampleCasesFromCsv()
  const sampleCases = dedupeCasesByProcessNumber([...csvCases, ...EXTRA_SAMPLE_CASES])

  if (sampleCases.length === 0) {
    throw new Error(`Nenhum processo valido encontrado em ${PROCESSOS_EM_ANDAMENTO_CSV}.`)
  }

  const removedLegacy = await Case.deleteMany({
    processNumber: { $in: LEGACY_SAMPLE_PROCESS_NUMBERS },
  })

  if (removedLegacy.deletedCount > 0) {
    console.log(`Removidos ${removedLegacy.deletedCount} processos legados do seed antigo.`)
  }

  const createdUsers = []
  let createdUsersCount = 0

  for (const userData of sampleUsers) {
    let user = await User.findOne({ email: userData.email })

    if (!user) {
      user = await User.create(userData)
      createdUsersCount += 1
      console.log(`Usuario criado: ${user.email}`)
    }

    createdUsers.push(user)
  }

  let insertedCases = 0
  let skippedCases = 0

  for (let index = 0; index < sampleCases.length; index += 1) {
    const caseData = sampleCases[index]
    const existingCase = await Case.findOne({ processNumber: caseData.processNumber }).select('_id')

    if (existingCase) {
      skippedCases += 1
      continue
    }

    const assignedLawyer = createdUsers[index % createdUsers.length]

    await Case.create({
      ...caseData,
      assignedLawyerId: assignedLawyer?._id || null,
    })

    insertedCases += 1
  }

  console.log(`Usuarios existentes/criados: ${createdUsers.length} (novos: ${createdUsersCount})`)
  console.log(`Processos carregados do CSV + extras: ${sampleCases.length}`)
  console.log(`Processos inseridos: ${insertedCases}`)
  console.log(`Processos ja existentes (nao inseridos): ${skippedCases}`)
  console.log('Seed finalizada com sucesso.')

  process.exit(0)
}

runSeed().catch((error) => {
  console.error('Falha ao executar seed:', error)
  process.exit(1)
})
