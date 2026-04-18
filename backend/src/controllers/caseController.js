import Case from '../models/CaseModel.js'
import mongoose from 'mongoose'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-5.4'
const AI_DISCLAIMER =
  'Esta e uma sugestao automatizada e nao substitui validacao do advogado responsavel.'
const DEFAULT_DEFENSE_COST = Number(process.env.CUSTO_DEFESA_PADRAO || 7000)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const PRECOMPUTED_ANALYSIS_CSV = path.resolve(
  REPO_ROOT,
  'db',
  'processed',
  'processos_em_andamento_avaliados.csv'
)

let openaiClient = null
let precomputedMetricsByProcess = null
let precomputedMetricsMtimeMs = null

function parseCsvLineValues(line) {
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

function toNumberOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeProcessNumberKey(value) {
  return String(value || '').trim()
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getValueByAliases(record, aliases) {
  if (!record || typeof record !== 'object') {
    return ''
  }

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias)) {
      return record[alias]
    }
  }

  const normalizedRecord = {}
  for (const [key, value] of Object.entries(record)) {
    normalizedRecord[normalizeLookupKey(key)] = value
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeLookupKey(alias)
    if (Object.prototype.hasOwnProperty.call(normalizedRecord, normalizedAlias)) {
      return normalizedRecord[normalizedAlias]
    }
  }

  return ''
}

function toPercent(value) {
  const parsed = toNumberOrNull(value)
  if (parsed === null) {
    return null
  }

  if (parsed >= 0 && parsed <= 1) {
    return parsed * 100
  }

  return parsed
}

function computeEconomyFromMetrics({ economyFromCsv, expectedLoss, expectedAgreementCost }) {
  if (economyFromCsv !== null) {
    return economyFromCsv
  }

  if (expectedLoss === null || expectedAgreementCost === null) {
    return null
  }

  if (!Number.isFinite(DEFAULT_DEFENSE_COST)) {
    return null
  }

  return expectedLoss + DEFAULT_DEFENSE_COST - expectedAgreementCost
}

function buildExpectativaResumo({ decision, economy }) {
  if (!decision && economy === null) {
    return 'Sem dados suficientes para expectativa financeira.'
  }

  if (decision === 'acordo') {
    if (economy === null) {
      return 'Acordo recomendado; expectativa de reducao de risco financeiro.'
    }

    if (economy >= 0) {
      return 'Acordo recomendado com expectativa de economia frente a defesa.'
    }

    return 'Acordo recomendado para reduzir risco processual, apesar do custo esperado maior.'
  }

  if (decision === 'defesa') {
    if (economy === null) {
      return 'Defesa recomendada por perfil de vitoria mais favoravel.'
    }

    if (economy < 0) {
      return 'Defesa recomendada com expectativa financeira melhor que o acordo.'
    }

    return 'Defesa recomendada por estrategia juridica, com impacto financeiro proximo ao acordo.'
  }

  return 'Expectativa financeira equilibrada entre acordo e defesa.'
}

function loadPrecomputedMetricsByProcess() {
  if (!fs.existsSync(PRECOMPUTED_ANALYSIS_CSV)) {
    precomputedMetricsByProcess = new Map()
    precomputedMetricsMtimeMs = null
    return precomputedMetricsByProcess
  }

  const stats = fs.statSync(PRECOMPUTED_ANALYSIS_CSV)
  if (
    precomputedMetricsByProcess &&
    Number.isFinite(precomputedMetricsMtimeMs) &&
    precomputedMetricsMtimeMs === stats.mtimeMs
  ) {
    return precomputedMetricsByProcess
  }

  const raw = fs.readFileSync(PRECOMPUTED_ANALYSIS_CSV, 'utf-8').replace(/^\uFEFF/, '')
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    precomputedMetricsByProcess = new Map()
    precomputedMetricsMtimeMs = stats.mtimeMs
    return precomputedMetricsByProcess
  }

  const headers = parseCsvLineValues(lines[0]).map((header) => String(header || '').trim())
  const map = new Map()

  for (const line of lines.slice(1)) {
    const values = parseCsvLineValues(line)
    const row = {}

    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = values[i]
    }

    const processNumber = normalizeProcessNumberKey(
      getValueByAliases(row, ['Numero do processo', 'numero_do_processo', 'numero_processo'])
    )

    if (!processNumber) {
      continue
    }

    const winRatePercent = toPercent(row.chance_vitoria)
    const uncertaintyPercent = toPercent(row.incerteza)
    const agreementAcceptancePercent = toPercent(row.probabilidade_aceite)
    const agreementValue = toNumberOrNull(row.valor_acordo_justo)
    const expectedAgreementCost = toNumberOrNull(row.custo_total_esperado_acordo)
    const expectedLoss = toNumberOrNull(row.valor_esperado_perda)
    const economyFromCsv = toNumberOrNull(row.economia_estimada)
    const economy = computeEconomyFromMetrics({
      economyFromCsv,
      expectedLoss,
      expectedAgreementCost,
    })

    let decision = null
    if (agreementValue !== null && agreementValue > 0) {
      decision = 'acordo'
    } else if (winRatePercent !== null) {
      decision = winRatePercent >= 65 ? 'defesa' : 'acordo'
    }

    map.set(processNumber, {
      taxaVitoriaPercent: winRatePercent,
      incertezaPercent: uncertaintyPercent,
      valorAcordoProposto: agreementValue,
      probabilidadeAceiteAcordoPercent: agreementAcceptancePercent,
      custoTotalEsperadoAcordo: expectedAgreementCost,
      expectativaPerda: expectedLoss,
      custoDefesaEstimado: Number.isFinite(DEFAULT_DEFENSE_COST) ? DEFAULT_DEFENSE_COST : null,
      economiaFinanceiraEstimada: economy,
      decisaoSugerida: decision,
      expectativaResumo: buildExpectativaResumo({ decision, economy }),
      fonte: 'csv_modelo_preprocessado',
    })
  }

  precomputedMetricsByProcess = map
  precomputedMetricsMtimeMs = stats.mtimeMs
  return precomputedMetricsByProcess
}

function getPrecomputedMetricsForProcess(processNumber) {
  const normalizedKey = normalizeProcessNumberKey(processNumber)
  if (!normalizedKey) {
    return null
  }

  const map = loadPrecomputedMetricsByProcess()
  if (!map || map.size === 0) {
    return null
  }

  return map.get(normalizedKey) || null
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeStatus(value) {
  return normalizeText(value)
}

function mapStatusToFolderId(status) {
  const normalized = normalizeStatus(status)

  if (normalized.includes('urgente') || normalized.includes('prazo') || normalized.includes('liminar')) {
    return 4
  }

  if (normalized.includes('arquiv') || normalized.includes('baixado') || normalized.includes('transito')) {
    return 3
  }

  if (
    normalized.includes('aguardando') ||
    normalized.includes('pendente') ||
    normalized.includes('concluso') ||
    normalized.includes('despacho')
  ) {
    return 2
  }

  if (normalized.includes('analise') || normalized.includes('triagem') || normalized.includes('revisao')) {
    return 1
  }

  return 0
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatJudicialPhaseForSummary(value) {
  const normalized = normalizeText(value)
  const knownLabels = {
    'peticao inicial protocolada': 'Peticao inicial protocolada',
    'citacao pendente': 'Citacao pendente',
    'contestacao apresentada': 'Contestacao apresentada',
    instrucao: 'Em instrucao',
    sentenca: 'Sentenca',
    recurso: 'Em recurso',
    'fase processual nao confirmada': 'Fase processual ainda não confirmada',
  }

  if (knownLabels[normalized]) {
    return knownLabels[normalized]
  }

  const humanized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!humanized) {
    return 'Fase processual ainda não confirmada'
  }

  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

function clampConfidence(value, fallback = 0.5) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(parsed, 0), 1)
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY (ou OPEN_AI_KEY) nao configurada no .env.')
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}

function normalizeMessageContent(content) {
  if (!content) {
    return ''
  }

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text
        }

        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

function normalizeDecision(value) {
  const normalized = normalizeText(value)

  if (normalized === 'acordo') {
    return 'acordo'
  }

  if (normalized === 'defesa') {
    return 'defesa'
  }

  return ''
}

function normalizeLawyerDecisionStatus(value) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return 'pendente'
  }

  if (normalized.includes('validad')) {
    return 'validada'
  }

  if (normalized.includes('rejeit')) {
    return 'rejeitada'
  }

  if (normalized.includes('ajuste') || normalized.includes('complementar')) {
    return 'ajustes_solicitados'
  }

  return 'pendente'
}

function inferActionClass(caseData) {
  const subject = normalizeText(caseData?.subject)
  const subSubject = normalizeText(caseData?.subSubject)
  const merged = `${subject} ${subSubject}`

  if (merged.includes('bancario') || merged.includes('juros abusivos') || merged.includes('revisao')) {
    return 'revisional_bancaria'
  }

  if (merged.includes('dano moral') || merged.includes('indeniz') || merged.includes('responsabilidade civil')) {
    return 'indenizatoria'
  }

  if (merged.includes('cobranca') || merged.includes('execucao fiscal') || merged.includes('recuperacao de credito')) {
    return 'cobranca'
  }

  return 'geral'
}

function resolveFinancialLabel(caseData) {
  const actionClass = caseData.actionClass || inferActionClass(caseData)
  const clientRole = normalizeText(caseData.clientRole || 'autor')

  if (clientRole.includes('reu') || clientRole.includes('passivo')) {
    return 'Risco estimado de condenacao'
  }

  if (actionClass === 'revisional_bancaria') {
    return 'Proveito economico estimado'
  }

  if (actionClass === 'indenizatoria') {
    return 'Indenizacao estimada'
  }

  if (actionClass === 'cobranca') {
    return 'Valor recuperavel estimado'
  }

  return 'Estimativa financeira'
}

function buildFinancialEstimate(caseData) {
  const existing = caseData?.financialEstimate || {}
  const estimatedValue = Number(existing.estimatedValue ?? caseData?.condemnationValue ?? 0)
  const minValue = Number(existing.uncertaintyMin ?? estimatedValue * 0.8)
  const maxValue = Number(existing.uncertaintyMax ?? estimatedValue * 1.1)

  return {
    label: existing.label || resolveFinancialLabel(caseData),
    estimatedValue: Number.isFinite(estimatedValue) ? Math.max(0, estimatedValue) : 0,
    uncertaintyMin: Number.isFinite(minValue) ? Math.max(0, minValue) : 0,
    uncertaintyMax: Number.isFinite(maxValue) ? Math.max(0, maxValue) : 0,
    calculationBase:
      existing.calculationBase ||
      'Analise dos documentos anexados, historico processual e parametrizacao por classe de acao.',
    methodology:
      existing.methodology ||
      'Estimativa automatizada por regras juridicas e sinais estatisticos do historico de casos semelhantes.',
    documentsUsed: Array.isArray(existing.documentsUsed) ? existing.documentsUsed : [],
  }
}

function buildOrigins(caseData) {
  const metadataOrigins = caseData?.metadata?.origins || {}
  const now = caseData?.updatedAt || new Date()

  const pick = (entry, fallbackSource, fallbackDate) => ({
    source: String(entry?.source || fallbackSource),
    updatedAt: entry?.updatedAt || fallbackDate || now,
  })

  return {
    judicialPhase: pick(metadataOrigins.judicialPhase, 'importado do tribunal', now),
    internalStatus: pick(metadataOrigins.internalStatus, 'informado pela equipe', now),
    recommendation: pick(
      metadataOrigins.recommendation,
      'estimado automaticamente',
      caseData?.recommendation?.generatedAt || now,
    ),
    lawyerDecision: pick(
      metadataOrigins.lawyerDecision,
      'informado pelo advogado',
      caseData?.result?.publishedAt || now,
    ),
    financialEstimate: pick(
      metadataOrigins.financialEstimate,
      'calculado com base nos documentos anexados',
      now,
    ),
  }
}

function buildConfidenceByBlock(caseData) {
  const current = caseData?.metadata?.confidenceByBlock || {}
  const hasPhase = !normalizeText(caseData?.judicialPhase).includes('nao confirmada')
  const hasThesis = Boolean(normalizeText(caseData?.suggestedThesis || caseData?.recommendation?.reasoning))
  const hasFinancialContext = Boolean(
    normalizeText(caseData?.financialEstimate?.methodology || caseData?.financialEstimate?.calculationBase),
  )

  return {
    subjectClassification: clampConfidence(current.subjectClassification, caseData?.subject ? 0.82 : 0.4),
    financialEstimate: clampConfidence(current.financialEstimate, hasFinancialContext ? 0.74 : 0.45),
    judicialPhase: clampConfidence(current.judicialPhase, hasPhase ? 0.78 : 0.35),
    suggestedThesis: clampConfidence(current.suggestedThesis, hasThesis ? 0.72 : 0.45),
  }
}

function buildTerminologyAlerts(caseData, financialEstimate) {
  const alerts = new Set(Array.isArray(caseData?.terminologyAlerts) ? caseData.terminologyAlerts : [])
  const subject = normalizeText(caseData?.subject)
  const subSubject = normalizeText(caseData?.subSubject)
  const label = normalizeText(financialEstimate.label)
  const clientRole = normalizeText(caseData?.clientRole || 'autor')

  if (subject.includes('bancario') && subSubject.includes('juros abusivos') && label.includes('condenacao')) {
    alerts.add(
      'Terminologia sugerida: para revisional bancaria, prefira "proveito economico estimado" em vez de "condenacao estimada".',
    )
  }

  if ((clientRole.includes('reu') || clientRole.includes('passivo')) && label.includes('valor recuperavel')) {
    alerts.add('Cliente em polo passivo: confirme se o campo financeiro nao deveria ser "risco estimado de condenacao".')
  }

  if (normalizeText(caseData?.judicialPhase).includes('nao confirmada')) {
    alerts.add('Fase processual judicial ainda nao confirmada; valide integracao com fonte oficial antes de concluir estrategia.')
  }

  return Array.from(alerts)
}

function mergeIssues(existingIssues, extraIssues) {
  const merged = [...(Array.isArray(existingIssues) ? existingIssues : []), ...extraIssues]
  const seen = new Set()

  return merged.filter((issue) => {
    const code = String(issue?.code || '')
    if (!code || seen.has(code)) {
      return false
    }
    seen.add(code)
    return true
  })
}

function buildConsistencyIssues(caseData, financialEstimate) {
  const extra = []
  const internalStatus = normalizeText(caseData?.internalStatus || caseData?.status)
  const judicialPhase = normalizeText(caseData?.judicialPhase)
  const lawyerDecisionStatus = normalizeLawyerDecisionStatus(caseData?.result?.status || caseData?.result?.decisionTaken)
  const recommendationConfidence = Number(caseData?.recommendation?.confidence || 0)
  const lawyerDecision = normalizeText(caseData?.result?.decisionTaken)
  const clientRole = normalizeText(caseData?.clientRole)
  const label = normalizeText(financialEstimate.label)
  const actionClass = caseData?.actionClass || inferActionClass(caseData)
  const actionContext = caseData?.actionContext || {}

  if (
    recommendationConfidence >= 0.75 &&
    (lawyerDecisionStatus === 'ajustes_solicitados' || lawyerDecision.includes('analise_complementar'))
  ) {
    extra.push({
      code: 'DIVERGENCIA_PENDENTE',
      severity: 'warning',
      message: 'Recomendacao automatizada com alta confianca diverge de decisao humana pendente de validacao.',
    })
  }

  if (
    (judicialPhase.includes('sentenca') || judicialPhase.includes('recurso')) &&
    internalStatus.includes('aguardando peticao inicial')
  ) {
    extra.push({
      code: 'FASE_INCOMPATIVEL',
      severity: 'error',
      message: 'Fase judicial avancada e status interno inicial parecem contraditorios. Revise cadastro.',
    })
  }

  if ((clientRole.includes('reu') || clientRole.includes('passivo')) && label.includes('valor recuperavel')) {
    extra.push({
      code: 'POLO_PASSIVO_TERMO_FINANCEIRO',
      severity: 'warning',
      message: 'Cliente em polo passivo com termo de recuperacao financeira. Confirme se a metrica esta correta.',
    })
  }

  if (!normalizeText(financialEstimate.calculationBase) || !normalizeText(financialEstimate.methodology)) {
    extra.push({
      code: 'ESTIMATIVA_SEM_MEMORIA',
      severity: 'warning',
      message: 'Estimativa financeira sem memoria de calculo completa (base/metodologia).',
    })
  }

  if (actionClass === 'revisional_bancaria') {
    const missing = []
    if (!normalizeText(actionContext.contractReference)) missing.push('contrato envolvido')
    if (!Number.isFinite(Number(actionContext.contractedRate))) missing.push('taxa contratada')
    if (!Number.isFinite(Number(actionContext.marketRate))) missing.push('taxa media de mercado')
    if (typeof actionContext.hasCapitalization !== 'boolean') missing.push('existencia de capitalizacao')
    if (!normalizeText(actionContext.mainClaim)) missing.push('pedido principal')
    if (typeof actionContext.urgencyReliefRequested !== 'boolean') missing.push('tutela de urgencia')
    if (!normalizeText(actionContext.causeValueCriteria)) missing.push('criterio do valor da causa')

    if (missing.length > 0) {
      extra.push({
        code: 'CADASTRO_INCOMPLETO_REVISIONAL',
        severity: 'warning',
        message: `Campos obrigatorios pendentes para revisional bancaria: ${missing.join(', ')}.`,
      })
    }
  }

  return mergeIssues(caseData?.consistencyIssues, extra)
}

function buildDecisionTrail(caseData) {
  const current = Array.isArray(caseData?.decisionTrail) ? [...caseData.decisionTrail] : []

  if (current.length === 0 && caseData?.recommendation?.decision) {
    current.push({
      type: 'recomendacao_inicial',
      actor: 'sistema',
      reason: caseData?.recommendation?.reasoning || 'Recomendacao automatizada inicial.',
      recommendationDecision: caseData?.recommendation?.decision,
      recommendationConfidence: Number(caseData?.recommendation?.confidence || 0),
      lawyerDecision: caseData?.result?.decisionTaken || '',
      createdAt: caseData?.recommendation?.generatedAt || caseData?.createdAt || new Date(),
    })
  }

  return current
}

function buildModelMetrics(caseData) {
  const metricsFromCsv = getPrecomputedMetricsForProcess(caseData?.processNumber)
  if (metricsFromCsv) {
    return metricsFromCsv
  }

  const recommendationDecision = normalizeDecision(caseData?.recommendation?.decision)
  const recommendationConfidencePercent =
    toNumberOrNull(caseData?.recommendation?.confidence) !== null
      ? Math.min(Math.max(Number(caseData.recommendation.confidence), 0), 1) * 100
      : null
  const suggestedAgreementValue = toNumberOrNull(caseData?.recommendation?.suggestedValue)
  const expectedLoss = toNumberOrNull(caseData?.condemnationValue)
  const expectedAgreementCost = suggestedAgreementValue
  const economy = computeEconomyFromMetrics({
    economyFromCsv: null,
    expectedLoss,
    expectedAgreementCost,
  })

  return {
    taxaVitoriaPercent: recommendationConfidencePercent,
    incertezaPercent: null,
    valorAcordoProposto: suggestedAgreementValue,
    probabilidadeAceiteAcordoPercent: null,
    custoTotalEsperadoAcordo: expectedAgreementCost,
    expectativaPerda: expectedLoss,
    custoDefesaEstimado: Number.isFinite(DEFAULT_DEFENSE_COST) ? DEFAULT_DEFENSE_COST : null,
    economiaFinanceiraEstimada: economy,
    decisaoSugerida: recommendationDecision || null,
    expectativaResumo: buildExpectativaResumo({
      decision: recommendationDecision || null,
      economy,
    }),
    fonte: 'fallback_recommendation',
  }
}

function prepareCaseView(caseData) {
  const internalStatus = caseData?.internalStatus || caseData?.status || 'em_analise'
  const judicialPhase = caseData?.judicialPhase || 'fase processual nao confirmada'
  const actionClass = caseData?.actionClass || inferActionClass(caseData)
  const clientRole = caseData?.clientRole || 'autor'
  const recommendationStatus = caseData?.recommendation?.status || 'preliminar'
  const lawyerDecisionStatus = normalizeLawyerDecisionStatus(
    caseData?.result?.status || caseData?.result?.decisionTaken,
  )
  const financialEstimate = buildFinancialEstimate({ ...caseData, actionClass, clientRole })
  const terminologyAlerts = buildTerminologyAlerts({ ...caseData, actionClass, clientRole }, financialEstimate)
  const consistencyIssues = buildConsistencyIssues(
    { ...caseData, internalStatus, judicialPhase, actionClass, clientRole },
    financialEstimate,
  )
  const modelMetrics = buildModelMetrics(caseData)
  const origins = buildOrigins({ ...caseData, internalStatus, judicialPhase, financialEstimate })
  const confidenceByBlock = buildConfidenceByBlock({ ...caseData, financialEstimate, judicialPhase })

  return {
    ...caseData,
    internalStatus,
    judicialStatus: caseData?.judicialStatus || 'nao_confirmado',
    judicialPhase,
    actionClass,
    clientRole,
    suggestedThesis: caseData?.suggestedThesis || caseData?.recommendation?.decision || '',
    actionContext: caseData?.actionContext || {},
    recommendation: {
      ...(caseData?.recommendation || {}),
      status: recommendationStatus,
      generatedAt: caseData?.recommendation?.generatedAt || caseData?.updatedAt || new Date(),
      disclaimer: caseData?.recommendation?.disclaimer || AI_DISCLAIMER,
    },
    result: {
      ...(caseData?.result || {}),
      status: lawyerDecisionStatus,
    },
    financialEstimate,
    modelMetrics,
    terminologyAlerts,
    consistencyIssues,
    decisionTrail: buildDecisionTrail(caseData),
    metadata: {
      ...(caseData?.metadata || {}),
      origins,
      confidenceByBlock,
    },
  }
}

function mapCaseToDocument(caseItem) {
  const prepared = prepareCaseView(caseItem)

  return {
    id: String(prepared._id),
    folderId: mapStatusToFolderId(prepared.internalStatus),
    title: `Processo ${prepared.processNumber}`,
    type: prepared.subject || 'Assunto nao informado',
    subType: prepared.subSubject || '',
    date: formatDate(prepared.updatedAt || prepared.createdAt),
    status: prepared.internalStatus,
    processNumber: prepared.processNumber,
    uf: prepared.uf,
    claimValue: prepared.claimValue,
    condemnationValue: prepared.condemnationValue,
    macroResult: prepared.macroResult,
    microResult: prepared.microResult,
    judicialStatus: prepared.judicialStatus,
    judicialPhase: prepared.judicialPhase,
    internalStatus: prepared.internalStatus,
    actionClass: prepared.actionClass,
    clientRole: prepared.clientRole,
    suggestedThesis: prepared.suggestedThesis,
    actionContext: prepared.actionContext || {},
    recommendation: prepared.recommendation,
    result: prepared.result,
    financialEstimate: prepared.financialEstimate,
    modelMetrics: prepared.modelMetrics || {},
    consistencyIssues: prepared.consistencyIssues,
    terminologyAlerts: prepared.terminologyAlerts,
    dataOrigins: prepared.metadata?.origins || {},
    confidenceByBlock: prepared.metadata?.confidenceByBlock || {},
    decisionTrail: prepared.decisionTrail,
    assignedLawyerId: prepared.assignedLawyerId ? String(prepared.assignedLawyerId) : null,
  }
}

function buildCaseSummary(caseData) {
  const prepared = prepareCaseView(caseData)
  const range = `${formatMoney(prepared.financialEstimate.uncertaintyMin)} a ${formatMoney(prepared.financialEstimate.uncertaintyMax)}`
  const judicialPhaseLabel = formatJudicialPhaseForSummary(prepared.judicialPhase)
  const modelMetrics = prepared.modelMetrics || {}
  const winRateLabel =
    Number.isFinite(Number(modelMetrics.taxaVitoriaPercent))
      ? `${Number(modelMetrics.taxaVitoriaPercent).toFixed(1)}%`
      : 'Nao informado'
  const proposedAgreementLabel =
    Number.isFinite(Number(modelMetrics.valorAcordoProposto))
      ? formatMoney(modelMetrics.valorAcordoProposto)
      : 'Nao informado'

  const lines = [
    `Digest juridico do processo ${prepared.processNumber || 'sem numero'} (${prepared.uf || '--'}):`,
    `Andamento no tribunal: ${judicialPhaseLabel}.`,
    `Status interno do escritorio: ${prepared.internalStatus}.`,
    `Classificacao da acao: ${prepared.actionClass}. Papel do cliente: ${prepared.clientRole}.`,
    `Assunto principal: ${prepared.subject || 'Nao informado'} | Subassunto: ${prepared.subSubject || 'Nao informado'}.`,
    `Valor da causa: ${formatMoney(prepared.claimValue)}. ${prepared.financialEstimate.label}: ${formatMoney(prepared.financialEstimate.estimatedValue)} (faixa ${range}).`,
    `Taxa de vitoria estimada: ${winRateLabel}. Valor de acordo proposto: ${proposedAgreementLabel}.`,
    `Recomendacao automatizada atual: ${prepared.recommendation?.decision || 'Nao informada'} (status ${prepared.recommendation?.status || 'preliminar'}).`,
    `Decisao humana do advogado: ${prepared.result?.decisionTaken || 'Nao informada'} (status ${prepared.result?.status || 'pendente'}).`,
    `Base da estimativa: ${prepared.financialEstimate.calculationBase}`,
  ]

  return lines.join('\n\n')
}

function parseRecommendationJson(content) {
  if (!content) {
    return null
  }

  const sanitized = content.replace(/```json|```/gi, '').trim()

  try {
    const parsed = JSON.parse(sanitized)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const decision = normalizeDecision(parsed.decision)
    if (!decision) {
      return null
    }

    const suggestedValue = Number(parsed.suggestedValue)
    const explanation = String(parsed.explanation || '').trim()
    const confidenceRaw = Number(parsed.confidence)

    return {
      decision,
      suggestedValue: Number.isFinite(suggestedValue) ? Math.max(0, suggestedValue) : 0,
      explanation,
      confidence: Number.isFinite(confidenceRaw) ? Math.min(Math.max(confidenceRaw, 0), 1) : null,
      status: 'preliminar',
      generatedAt: new Date(),
      disclaimer: AI_DISCLAIMER,
    }
  } catch {
    return null
  }
}

async function buildAiRecommendation(caseItem) {
  const prepared = prepareCaseView(caseItem)
  const fallbackDecision = normalizeDecision(prepared?.recommendation?.decision) || 'defesa'
  const fallbackValue = Number(prepared?.recommendation?.suggestedValue || 0)
  const fallbackExplanation =
    String(prepared?.recommendation?.reasoning || '').trim() ||
    'A recomendacao foi estruturada considerando fase processual, risco financeiro, consistencia documental e tese juridica aplicavel. Use como insumo tecnico inicial e valide com estrategia processual do caso concreto.'

  try {
    const client = getOpenAIClient()
    const caseSummary = buildCaseSummary(prepared)
    const modelTrainingContext = [
      'Contexto de treinamento de ML disponivel no sistema:',
      '- modelo de taxa de sucesso em backend/ml/models/SucessRate/train_vitoria_gp.py',
      '- modelo de sugestao de acordo em backend/ml/models/Acordo/train_acordo_gp.py',
      `- sinal pre-calculado no processo: decisao="${prepared?.recommendation?.decision || 'nao informado'}", valor=${Number(prepared?.recommendation?.suggestedValue || 0)}, confianca=${Number(prepared?.recommendation?.confidence || 0)}`,
      `- justificativa historica do modelo: ${prepared?.recommendation?.reasoning || 'nao informada'}`,
      `- alertas terminologicos atuais: ${(prepared.terminologyAlerts || []).join(' | ') || 'sem alertas'}`,
    ].join('\n')

    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'Voce e um assistente juridico para decisao estrategica entre acordo e defesa.',
            'Responda em JSON valido com as chaves: decision, explanation, suggestedValue, confidence.',
            'decision deve ser apenas "acordo" ou "defesa".',
            'explanation deve ser detalhada (5 a 8 frases), incluindo fundamentos, riscos, impacto financeiro e proximo passo pratico.',
            'Nao trate recomendacao como decisao final humana.',
            'suggestedValue deve ser numero em BRL.',
            'confidence deve estar entre 0 e 1.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Resumo do caso:\n${caseSummary}\n\n${modelTrainingContext}`,
        },
      ],
    })

    const raw = normalizeMessageContent(completion.choices?.[0]?.message?.content)
    const parsed = parseRecommendationJson(raw)

    if (!parsed) {
      throw new Error('Falha ao interpretar JSON de recomendacao.')
    }

    return parsed
  } catch {
    return {
      decision: fallbackDecision,
      suggestedValue: Number.isFinite(fallbackValue) ? Math.max(0, fallbackValue) : 0,
      explanation: fallbackExplanation,
      confidence: clampConfidence(prepared?.recommendation?.confidence, 0.6),
      status: 'preliminar',
      generatedAt: prepared?.recommendation?.generatedAt || new Date(),
      disclaimer: AI_DISCLAIMER,
    }
  }
}

export const listCases = async (req, res) => {
  try {
    const cases = await Case.find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()

    const documents = cases.map(mapCaseToDocument)

    return res.status(200).json({
      success: true,
      total: documents.length,
      data: documents,
    })
  } catch (error) {
    console.error('Erro ao listar processos:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar processos.',
    })
  }
}

export const getCaseById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de processo invalido.',
      })
    }

    const caseItem = await Case.findById(id).lean()

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        message: 'Processo nao encontrado.',
      })
    }

    return res.status(200).json({
      success: true,
      data: mapCaseToDocument(caseItem),
    })
  } catch (error) {
    console.error('Erro ao buscar processo por ID:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar processo.',
    })
  }
}

export const getCaseRecommendation = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de processo invalido.',
      })
    }

    const caseItem = await Case.findById(id).lean()

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        message: 'Processo nao encontrado.',
      })
    }

    const aiRecommendation = await buildAiRecommendation(caseItem)
    const prepared = prepareCaseView({ ...caseItem, recommendation: { ...(caseItem.recommendation || {}), ...aiRecommendation } })

    return res.status(200).json({
      success: true,
      data: {
        summary: buildCaseSummary(prepared),
        recommendation: aiRecommendation,
        consistencyIssues: prepared.consistencyIssues,
        terminologyAlerts: prepared.terminologyAlerts,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar recomendacao do processo:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar recomendacao do processo.',
    })
  }
}

export const finalizeCaseDecision = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de processo invalido.',
      })
    }

    const decision = normalizeDecision(req.body?.decision)
    const justification = String(req.body?.justification || '').trim()
    const agreementValueRaw = Number(req.body?.agreementValue)

    if (!decision) {
      return res.status(400).json({
        success: false,
        message: 'Selecione uma decisao valida: acordo ou defesa.',
      })
    }

    if (!justification) {
      return res.status(400).json({
        success: false,
        message: 'Informe a justificativa de finalizacao.',
      })
    }

    if (decision === 'acordo' && (!Number.isFinite(agreementValueRaw) || agreementValueRaw <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Para acordo, informe um valor valido maior que zero.',
      })
    }

    const caseItem = await Case.findById(id)

    if (!caseItem) {
      return res.status(404).json({
        success: false,
        message: 'Processo nao encontrado.',
      })
    }

    const alreadyPublished =
      Boolean(caseItem?.result?.publishedAt) ||
      String(caseItem?.result?.status || '').toLowerCase().trim() === 'validada'

    if (alreadyPublished) {
      return res.status(409).json({
        success: false,
        message: 'Este processo ja possui resposta do advogado registrada. So e permitido 1 envio por processo.',
      })
    }

    const finalValue = decision === 'acordo' ? agreementValueRaw : 0
    const publishedAt = new Date()

    caseItem.result = {
      ...(caseItem.result?.toObject?.() || caseItem.result || {}),
      decisionTaken: decision,
      status: 'validada',
      finalValue,
      outcome: 'finalizado_pelo_advogado',
      effective: true,
      justification,
      publishedAt,
    }

    caseItem.internalStatus = 'decisao_validada'
    caseItem.status = 'finalizado'

    const trail = Array.isArray(caseItem.decisionTrail) ? [...caseItem.decisionTrail] : []
    trail.push({
      type: 'decisao_humana_validada',
      actor: 'advogado',
      reason: justification,
      recommendationDecision: caseItem.recommendation?.decision || '',
      recommendationConfidence: Number(caseItem.recommendation?.confidence || 0),
      lawyerDecision: decision,
      createdAt: publishedAt,
    })
    caseItem.decisionTrail = trail

    caseItem.metadata = {
      ...(caseItem.metadata?.toObject?.() || caseItem.metadata || {}),
      origins: {
        ...((caseItem.metadata?.origins?.toObject?.() || caseItem.metadata?.origins || {})),
        lawyerDecision: {
          source: 'informado pelo advogado',
          updatedAt: publishedAt,
        },
        internalStatus: {
          source: 'informado pela equipe',
          updatedAt: publishedAt,
        },
      },
    }

    await caseItem.save()

    return res.status(200).json({
      success: true,
      message: 'Resultado publicado com sucesso.',
      data: {
        case: mapCaseToDocument(caseItem.toObject()),
        publication: {
          decision,
          agreementValue: finalValue,
          justification,
          publishedAt: publishedAt.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error('Erro ao finalizar resultado do processo:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao finalizar resultado do processo.',
    })
  }
}



