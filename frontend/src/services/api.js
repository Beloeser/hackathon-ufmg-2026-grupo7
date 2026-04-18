import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function sendChatMessage({
  message,
  history = [],
  context = null,
  contractNumbers = [],
  processNumbers = [],
  contractInputs = [],
  contratosCsv,
}) {
  const payload = {
    message,
    history,
    context,
  }

  const mergedProcessNumbers = Array.from(
    new Set([...contractNumbers, ...processNumbers].map((value) => String(value || '').trim()).filter(Boolean))
  )

  if (mergedProcessNumbers.length > 0) {
    payload.contractNumbers = mergedProcessNumbers
  }

  if (Array.isArray(contractInputs) && contractInputs.length > 0) {
    payload.contractInputs = contractInputs
  }

  if (typeof contratosCsv === 'string' && contratosCsv.trim()) {
    payload.contratosCsv = contratosCsv.trim()
  }

  const response = await api.post('/chat', payload)
  return response.data
}

// Dashboard API Methods
export async function getDashboardAnalytics() {
  const response = await api.get('/admin/dashboard/analytics')
  return response.data
}

export async function getCaseComparisons() {
  const response = await api.get('/admin/dashboard/comparisons')
  return response.data
}

export async function getLawyerPerformance() {
  const response = await api.get('/admin/dashboard/lawyer-performance')
  return response.data
}

export async function fetchCases() {
  const response = await api.get('/cases')
  return response.data
}

export async function fetchCaseById(caseId) {
  const response = await api.get(`/cases/${caseId}`)
  return response.data
}

export async function fetchCaseRecommendation(caseId) {
  const response = await api.get(`/cases/${caseId}/recommendation`)
  return response.data
}

export async function finalizeCaseResult(caseId, payload) {
  const response = await api.post(`/cases/${caseId}/finalize`, payload)
  return response.data
}

export default api
