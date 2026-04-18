import Case from '../models/CaseModel.js'
import User from '../models/UserModel.js'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeDecision(value) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return 'unknown'
  }

  if (normalized.includes('acordo')) {
    return 'acordo'
  }

  if (normalized.includes('defes')) {
    return 'defense'
  }

  if (
    normalized.includes('pendente') ||
    normalized.includes('andamento') ||
    normalized.includes('em_andamento') ||
    normalized.includes('analise')
  ) {
    return 'pending'
  }

  return 'unknown'
}

function getLatestTrailEntry(caseData) {
  const trail = Array.isArray(caseData?.decisionTrail) ? caseData.decisionTrail : []
  if (trail.length === 0) {
    return null
  }

  return trail
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())[0]
}

function extractModelDecision(caseData) {
  const directDecision = normalizeDecision(caseData?.recommendation?.decision)
  if (directDecision !== 'unknown') {
    return directDecision
  }

  return normalizeDecision(getLatestTrailEntry(caseData)?.recommendationDecision)
}

function extractLawyerDecision(caseData) {
  const directDecision = normalizeDecision(caseData?.result?.decisionTaken)
  if (directDecision !== 'unknown') {
    return directDecision
  }

  const resultStatus = normalizeText(caseData?.result?.status)
  if (resultStatus.includes('pendente') || resultStatus.includes('ajuste') || resultStatus.includes('analise')) {
    return 'pending'
  }

  return normalizeDecision(getLatestTrailEntry(caseData)?.lawyerDecision)
}

function isComparableDecision(modelDecision, lawyerDecision) {
  const comparableModel = modelDecision === 'acordo' || modelDecision === 'defense'
  const comparableLawyer = lawyerDecision === 'acordo' || lawyerDecision === 'defense'
  return comparableModel && comparableLawyer
}

function toDecisionLabel(decision) {
  if (decision === 'acordo') return 'Acordo'
  if (decision === 'defense') return 'Defesa'
  if (decision === 'pending') return 'Pendente'
  return 'Indefinido'
}

function parseMoney(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return 0
  }

  return numberValue
}

// Get overall analytics and comparisons
export const getDashboardAnalytics = async (req, res) => {
  try {
    const cases = await Case.find().populate('assignedLawyerId')

    if (cases.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalCases: 0,
          comparedCases: 0,
          pendingCases: 0,
          lawyerFollowedModel: 0,
          adherencePercentage: 0,
          totalMoneySaved: 0,
          averageMoneyPerCase: 0,
          casesByDecision: {
            acordo: 0,
            defense: 0,
            pendente: 0,
          },
          eventMetrics: {
            totalResponses: 0,
            comparableResponses: 0,
            followedModelResponses: 0,
            divergedResponses: 0,
            adherencePercentage: 0,
          },
          lawyerMetrics: [],
        },
      })
    }

    let followedCount = 0
    let comparedCases = 0
    let pendingCases = 0
    let totalMoneySaved = 0
    let totalResponses = 0
    let comparableResponses = 0
    let followedModelResponses = 0
    let divergedResponses = 0

    const lawyerStats = {}

    cases.forEach((caseData) => {
      const lawyerId = caseData.assignedLawyerId?._id?.toString() || 'unknown'
      const lawyerName = caseData.assignedLawyerId?.name || 'Unknown'

      if (!lawyerStats[lawyerId]) {
        lawyerStats[lawyerId] = {
          lawyerId,
          lawyerName,
          totalCases: 0,
          decidedCases: 0,
          pendingCases: 0,
          followedModel: 0,
          ignoredModel: 0,
          totalMoneySaved: 0,
          adherencePercentage: 0,
        }
      }

      const stats = lawyerStats[lawyerId]
      stats.totalCases += 1

      const modelDecision = extractModelDecision(caseData)
      const lawyerDecision = extractLawyerDecision(caseData)

      if (lawyerDecision === 'pending' || lawyerDecision === 'unknown') {
        pendingCases += 1
        stats.pendingCases += 1
      }

      if (isComparableDecision(modelDecision, lawyerDecision)) {
        comparedCases += 1
        stats.decidedCases += 1

        const matchesModel = modelDecision === lawyerDecision

        if (matchesModel) {
          followedCount += 1
          stats.followedModel += 1

          const suggestedValue = parseMoney(caseData.recommendation?.suggestedValue)
          const actualValue = parseMoney(caseData.result?.finalValue)

          if (suggestedValue > 0 && actualValue > 0) {
            const moneySaved = Math.abs(actualValue - suggestedValue)
            totalMoneySaved += moneySaved
            stats.totalMoneySaved += moneySaved
          }
        } else {
          stats.ignoredModel += 1
        }
      }

      const decisionTrail = Array.isArray(caseData.decisionTrail) ? caseData.decisionTrail : []
      decisionTrail.forEach((entry) => {
        const entryType = normalizeText(entry?.type)
        if (!entryType.includes('decisao_humana_validada')) {
          return
        }

        totalResponses += 1

        const modelAtEvent = normalizeDecision(entry?.recommendationDecision || caseData.recommendation?.decision)
        const lawyerAtEvent = normalizeDecision(entry?.lawyerDecision)

        if (!isComparableDecision(modelAtEvent, lawyerAtEvent)) {
          return
        }

        comparableResponses += 1

        if (modelAtEvent === lawyerAtEvent) {
          followedModelResponses += 1
        } else {
          divergedResponses += 1
        }
      })
    })

    Object.keys(lawyerStats).forEach((lawyerId) => {
      const stats = lawyerStats[lawyerId]
      stats.adherencePercentage =
        stats.decidedCases > 0 ? ((stats.followedModel / stats.decidedCases) * 100).toFixed(2) : '0.00'
      stats.totalMoneySaved = Number(stats.totalMoneySaved.toFixed(2))
    })

    const lawyerMetrics = Object.values(lawyerStats).sort(
      (a, b) => parseFloat(b.adherencePercentage) - parseFloat(a.adherencePercentage),
    )

    const casesByDecision = {
      acordo: 0,
      defense: 0,
      pendente: 0,
    }

    cases.forEach((caseData) => {
      const lawyerDecision = extractLawyerDecision(caseData)

      if (lawyerDecision === 'acordo') {
        casesByDecision.acordo += 1
        return
      }

      if (lawyerDecision === 'defense') {
        casesByDecision.defense += 1
        return
      }

      casesByDecision.pendente += 1
    })

    const adherencePercentage = comparedCases > 0 ? ((followedCount / comparedCases) * 100).toFixed(2) : '0.00'
    const responseAdherencePercentage =
      comparableResponses > 0 ? ((followedModelResponses / comparableResponses) * 100).toFixed(2) : '0.00'

    return res.status(200).json({
      success: true,
      data: {
        totalCases: cases.length,
        comparedCases,
        pendingCases,
        lawyerFollowedModel: followedCount,
        adherencePercentage: Number(adherencePercentage),
        totalMoneySaved: Number(totalMoneySaved.toFixed(2)),
        averageMoneyPerCase: cases.length > 0 ? Number((totalMoneySaved / cases.length).toFixed(2)) : 0,
        casesByDecision,
        eventMetrics: {
          totalResponses,
          comparableResponses,
          followedModelResponses,
          divergedResponses,
          adherencePercentage: Number(responseAdherencePercentage),
        },
        lawyerMetrics,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados do dashboard',
    })
  }
}

// Get detailed case comparison
export const getCaseComparisons = async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('assignedLawyerId')
      .select('processNumber subject macroResult recommendation result decisionTrail assignedLawyerId claimValue condemnationValue')

    const comparisons = cases.map((caseData) => {
      const modelDecision = extractModelDecision(caseData)
      const lawyerDecision = extractLawyerDecision(caseData)
      const comparable = isComparableDecision(modelDecision, lawyerDecision)
      const matchesModel = comparable ? modelDecision === lawyerDecision : null

      const suggestedValue = parseMoney(caseData.recommendation?.suggestedValue)
      const finalValue = parseMoney(caseData.result?.finalValue)
      const moneySaved = suggestedValue > 0 && finalValue > 0 ? Math.abs(finalValue - suggestedValue) : 0

      return {
        processNumber: caseData.processNumber,
        subject: caseData.subject,
        lawyerName: caseData.assignedLawyerId?.name || 'Unknown',
        modelSuggestion: toDecisionLabel(modelDecision),
        modelConfidence: Number(((caseData.recommendation?.confidence || 0) * 100).toFixed(1)),
        lawyerChoice: toDecisionLabel(lawyerDecision),
        matchesModel,
        claimValue: caseData.claimValue,
        condemnationValue: caseData.condemnationValue,
        suggestedValue,
        finalValue,
        moneySaved,
      }
    })

    return res.status(200).json({
      success: true,
      data: comparisons,
    })
  } catch (error) {
    console.error('Error fetching case comparisons:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar comparacoes de casos',
    })
  }
}

// Get lawyer performance details
export const getLawyerPerformance = async (req, res) => {
  try {
    const lawyers = await User.find({ role: 'advogado' })
    const cases = await Case.find().populate('assignedLawyerId')

    const performance = await Promise.all(
      lawyers.map(async (lawyer) => {
        const lawyerCases = cases.filter(
          (caseData) => caseData.assignedLawyerId?._id.toString() === lawyer._id.toString(),
        )

        let followedModel = 0
        let comparedCases = 0
        let totalMoneySaved = 0

        lawyerCases.forEach((caseData) => {
          const modelDecision = extractModelDecision(caseData)
          const lawyerDecision = extractLawyerDecision(caseData)

          if (!isComparableDecision(modelDecision, lawyerDecision)) {
            return
          }

          comparedCases += 1

          if (modelDecision === lawyerDecision) {
            followedModel += 1
            totalMoneySaved += Math.abs(
              parseMoney(caseData.result?.finalValue) - parseMoney(caseData.recommendation?.suggestedValue),
            )
          }
        })

        return {
          lawyerId: lawyer._id,
          lawyerName: lawyer.name,
          totalCases: lawyerCases.length,
          decidedCases: comparedCases,
          followedModelCount: followedModel,
          adherencePercentage:
            comparedCases > 0 ? ((followedModel / comparedCases) * 100).toFixed(2) : '0.00',
          totalMoneySaved: Number(totalMoneySaved.toFixed(2)),
          caseDetails: lawyerCases.map((caseData) => ({
            processNumber: caseData.processNumber,
            subject: caseData.subject,
            status: caseData.status,
            modelSuggestion: caseData.recommendation?.decision || 'N/A',
          })),
        }
      }),
    )

    return res.status(200).json({
      success: true,
      data: performance,
    })
  } catch (error) {
    console.error('Error fetching lawyer performance:', error)
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar desempenho dos advogados',
    })
  }
}
