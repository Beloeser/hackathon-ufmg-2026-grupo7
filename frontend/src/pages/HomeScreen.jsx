import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { Clock, FileText, Folder, Sparkles, TrendingUp } from 'lucide-react'
import { usePersistentChatHistory } from '../hooks/usePersistentChatHistory'
import { fetchCases, sendChatMessage } from '../services/api'
import AssistantPanel from './home/components/AssistantPanel'
import DocumentsPanel from './home/components/DocumentsPanel'
import FoldersPanel from './home/components/FoldersPanel'
import HomeSidebar from './home/components/HomeSidebar'
import HomeTopbar from './home/components/HomeTopbar'

const FOLDER_DEFINITIONS = [
  { id: 0, name: 'Processos Ativos', icon: Folder },
  { id: 1, name: 'Em Analise', icon: TrendingUp },
  { id: 2, name: 'Aguardando Decisao', icon: Clock },
  { id: 3, name: 'Arquivados', icon: FileText },
  { id: 4, name: 'Urgentes', icon: Sparkles },
]

const DOCUMENT_MOCKS = [
  {
    id: 1,
    folderId: 0,
    title: 'Processo 1803258-78.2026.8.18.4949',
    type: 'Acao Civil Publica',
    date: '15/04/2026',
    status: 'Em andamento',
  },
  {
    id: 2,
    folderId: 0,
    title: 'Processo 8727380-45.2026.8.23.5908',
    type: 'Execucao Fiscal',
    date: '14/04/2026',
    status: 'Audiencia marcada',
  },
  {
    id: 3,
    folderId: 0,
    title: 'Processo 7839094-27.2026.8.10.5200',
    type: 'Acao de Cobranca',
    date: '14/04/2026',
    status: 'Contestacao apresentada',
  },
  {
    id: 4,
    folderId: 0,
    title: 'Processo 1394233-39.2026.8.07.6079',
    type: 'Cumprimento de Sentenca',
    date: '13/04/2026',
    status: 'Em diligencia',
  },
  {
    id: 5,
    folderId: 0,
    title: 'Processo 8494629-27.2026.8.22.1066',
    type: 'Acao Monitora',
    date: '12/04/2026',
    status: 'Pericia designada',
  },
  {
    id: 6,
    folderId: 0,
    title: 'Processo 8082318-17.2026.8.21.6170',
    type: 'Acao Trabalhista',
    date: '11/04/2026',
    status: 'Aguardando audiencia',
  },
  {
    id: 7,
    folderId: 1,
    title: 'Processo 8701036-35.2026.8.25.3642',
    type: 'Recurso de Apelacao',
    date: '14/04/2026',
    status: 'Aguardando analise',
  },
  {
    id: 8,
    folderId: 1,
    title: 'Processo 6957247-73.2026.8.05.9104',
    type: 'Embargos de Declaracao',
    date: '13/04/2026',
    status: 'Em triagem',
  },
  {
    id: 9,
    folderId: 1,
    title: 'Processo 4296371-90.2026.8.14.7296',
    type: 'Agravo de Instrumento',
    date: '13/04/2026',
    status: 'Analise documental',
  },
  {
    id: 10,
    folderId: 1,
    title: 'Processo 3392829-81.2026.8.16.5921',
    type: 'Acao de Indenizacao',
    date: '12/04/2026',
    status: 'Revisao juridica',
  },
  {
    id: 11,
    folderId: 1,
    title: 'Processo 0007990-82.2026.8.26.0224',
    type: 'Mandado de Seguranca',
    date: '11/04/2026',
    status: 'Aguardando parecer',
  },
  {
    id: 12,
    folderId: 1,
    title: 'Processo 0008012-04.2026.8.26.0224',
    type: 'Acao Possessoria',
    date: '10/04/2026',
    status: 'Em analise tecnica',
  },
  {
    id: 13,
    folderId: 2,
    title: 'Processo 0003456-78.2026.8.26.0587',
    type: 'Peticao Inicial',
    date: '12/04/2026',
    status: 'Aguardando decisao',
  },
  {
    id: 14,
    folderId: 2,
    title: 'Processo 0003501-30.2026.8.26.0587',
    type: 'Acao Revisional',
    date: '11/04/2026',
    status: 'Concluso para sentenca',
  },
  {
    id: 15,
    folderId: 2,
    title: 'Processo 0003588-19.2026.8.26.0587',
    type: 'Acao de Alimentos',
    date: '10/04/2026',
    status: 'Aguardando despacho',
  },
  {
    id: 16,
    folderId: 2,
    title: 'Processo 0003666-40.2026.8.26.0587',
    type: 'Tutela de Urgencia',
    date: '09/04/2026',
    status: 'Aguardando conclusao',
  },
  {
    id: 17,
    folderId: 2,
    title: 'Processo 0003720-11.2026.8.26.0587',
    type: 'Cumprimento Provisorio',
    date: '08/04/2026',
    status: 'Aguardando decisao interlocutoria',
  },
  {
    id: 18,
    folderId: 2,
    title: 'Processo 0003804-59.2026.8.26.0587',
    type: 'Acao de Obrigacao de Fazer',
    date: '07/04/2026',
    status: 'Pendente de despacho final',
  },
  {
    id: 19,
    folderId: 3,
    title: 'Processo 0009876-54.2026.8.26.0344',
    type: 'Mandado de Seguranca',
    date: '10/04/2026',
    status: 'Arquivado definitivamente',
  },
  {
    id: 20,
    folderId: 3,
    title: 'Processo 0009920-84.2026.8.26.0344',
    type: 'Acao Declaratoria',
    date: '09/04/2026',
    status: 'Baixado',
  },
  {
    id: 21,
    folderId: 3,
    title: 'Processo 0009958-27.2026.8.26.0344',
    type: 'Execucao de Titulo',
    date: '08/04/2026',
    status: 'Arquivado por acordo',
  },
  {
    id: 22,
    folderId: 3,
    title: 'Processo 0010002-71.2026.8.26.0344',
    type: 'Acao de Reparacao',
    date: '07/04/2026',
    status: 'Transito em julgado',
  },
  {
    id: 23,
    folderId: 3,
    title: 'Processo 0010044-18.2026.8.26.0344',
    type: 'Execucao Trabalhista',
    date: '06/04/2026',
    status: 'Arquivo morto',
  },
  {
    id: 24,
    folderId: 3,
    title: 'Processo 0010099-06.2026.8.26.0344',
    type: 'Acao de Inventario',
    date: '05/04/2026',
    status: 'Arquivado sem baixa pendente',
  },
  {
    id: 25,
    folderId: 4,
    title: 'Processo 0002468-13.2026.8.26.0176',
    type: 'Acao Trabalhista',
    date: '08/04/2026',
    status: 'Prazo em 24h',
  },
  {
    id: 26,
    folderId: 4,
    title: 'Processo 0002520-95.2026.8.26.0176',
    type: 'Acao Cautelar',
    date: '08/04/2026',
    status: 'Risco de prescricao',
  },
  {
    id: 27,
    folderId: 4,
    title: 'Processo 0002608-43.2026.8.26.0176',
    type: 'Tutela Antecipada',
    date: '07/04/2026',
    status: 'Liminar pendente',
  },
  {
    id: 28,
    folderId: 4,
    title: 'Processo 0002688-77.2026.8.26.0176',
    type: 'Reintegracao de Posse',
    date: '06/04/2026',
    status: 'Peticao urgente para hoje',
  },
]
const PageGrid = styled.div`
  display: grid;
  grid-template-columns: ${({ $chatOpen }) =>
    $chatOpen ? '76px 360px minmax(0, 1fr) minmax(340px, 420px)' : '76px 360px minmax(0, 1fr)'};
  grid-template-rows: 96px minmax(0, 1fr);
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: #f3f4f6;
`

const DashboardChatSlot = styled.div`
  grid-column: 4;
  grid-row: 2;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`

function createChatMessage(role, content) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function buildChatContext({ selectedDocument, selectedFolder, folders }) {
  if (selectedDocument) {
    return {
      key: `process:${selectedDocument.id}`,
      type: 'process',
      id: selectedDocument.id,
      label: selectedDocument.title,
    }
  }

  const activeFolder = folders.find((folder) => folder.id === selectedFolder)

  return {
    key: `folder:${selectedFolder}`,
    type: 'folder',
    id: selectedFolder,
    label: activeFolder?.name || `Pasta ${selectedFolder}`,
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const PROCESS_NUMBER_REGEX = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/

function extractProcessNumberFromText(value) {
  const text = String(value || '')
  const match = text.match(PROCESS_NUMBER_REGEX)
  return match ? match[0] : null
}

function mapStatusToFolderId(status) {
  const normalizedStatus = normalizeText(status)

  if (
    normalizedStatus.includes('urgente') ||
    normalizedStatus.includes('prazo') ||
    normalizedStatus.includes('liminar')
  ) {
    return 4
  }

  if (
    normalizedStatus.includes('arquiv') ||
    normalizedStatus.includes('baixado') ||
    normalizedStatus.includes('transito')
  ) {
    return 3
  }

  if (
    normalizedStatus.includes('aguardando') ||
    normalizedStatus.includes('pendente') ||
    normalizedStatus.includes('concluso') ||
    normalizedStatus.includes('despacho')
  ) {
    return 2
  }

  if (
    normalizedStatus.includes('analise') ||
    normalizedStatus.includes('triagem') ||
    normalizedStatus.includes('revisao')
  ) {
    return 1
  }

  return 0
}

function formatDateFromValue(value) {
  if (!value) {
    return ''
  }

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

function extractCaseList(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.cases)) {
    return payload.cases
  }

  return []
}

function normalizeIncomingDocument(rawDocument, index) {
  if (!rawDocument || typeof rawDocument !== 'object') {
    return null
  }

  const idSource = rawDocument.id || rawDocument._id || rawDocument.processNumber || `case-${index}`
  const id = String(idSource)
  const status = String(rawDocument.status || 'em_analise')
  const folderIdCandidate = Number(rawDocument.folderId)
  const folderId = Number.isFinite(folderIdCandidate) ? folderIdCandidate : mapStatusToFolderId(status)

  return {
    id,
    folderId,
    title: rawDocument.title || (rawDocument.processNumber ? `Processo ${rawDocument.processNumber}` : `Processo ${id}`),
    type: rawDocument.type || rawDocument.subject || 'Assunto nao informado',
    date: rawDocument.date || formatDateFromValue(rawDocument.updatedAt || rawDocument.createdAt),
    status,
    processNumber: rawDocument.processNumber || '',
  }
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const [selectedFolder, setSelectedFolder] = useState(0)
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [viewMode, setViewMode] = useState('card')
  const [searchQuery, setSearchQuery] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [sidebarActive, setSidebarActive] = useState('home')
  const [chatInput, setChatInput] = useState('')
  const [loadingContextKey, setLoadingContextKey] = useState(null)
  const [chatErrorsByContext, setChatErrorsByContext] = useState({})
  const [documents, setDocuments] = useState([])
  const [isCasesLoading, setIsCasesLoading] = useState(true)
  const [casesError, setCasesError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadCases = async () => {
      setIsCasesLoading(true)
      setCasesError('')

      try {
        const payload = await fetchCases()
        const rawCases = extractCaseList(payload)
        const normalizedCases = rawCases
          .map((caseItem, index) => normalizeIncomingDocument(caseItem, index))
          .filter(Boolean)

        if (!isMounted) {
          return
        }

        setDocuments(normalizedCases)
      } catch (error) {
        if (!isMounted) {
          return
        }

        const message =
          error?.response?.data?.message || error?.message || 'Nao foi possivel carregar os processos do backend.'

        setDocuments([])
        setCasesError(message)
      } finally {
        if (isMounted) {
          setIsCasesLoading(false)
        }
      }
    }

    loadCases()

    return () => {
      isMounted = false
    }
  }, [])

  const foldersWithCount = useMemo(() => {
    const countByFolder = documents.reduce((accumulator, document) => {
      const currentCount = accumulator[document.folderId] || 0
      return {
        ...accumulator,
        [document.folderId]: currentCount + 1,
      }
    }, {})

    return FOLDER_DEFINITIONS.map((folder) => ({
      ...folder,
      count: countByFolder[folder.id] || 0,
    }))
  }, [documents])

  const documentsForSelectedFolder = useMemo(
    () => documents.filter((document) => document.folderId === selectedFolder),
    [documents, selectedFolder],
  )

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery.trim())

    return documentsForSelectedFolder.filter((document) => {
      const searchableText = normalizeText(
        `${document.title} ${document.type} ${document.status} ${document.date} ${document.processNumber}`,
      )

      return normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)
    })
  }, [documentsForSelectedFolder, searchQuery])

  const selectedDocument = useMemo(
    () => documents.find((document) => String(document.id) === String(selectedDocumentId)) || null,
    [documents, selectedDocumentId],
  )

  const activeChatContext = useMemo(
    () => buildChatContext({ selectedDocument, selectedFolder, folders: foldersWithCount }),
    [selectedDocument, selectedFolder, foldersWithCount],
  )

  const { messages: chatMessages, updateMessagesForContext } = usePersistentChatHistory({
    contextKey: activeChatContext.key,
    contextType: activeChatContext.type,
    contextLabel: activeChatContext.label,
  })

  const chatError = chatErrorsByContext[activeChatContext.key] || ''
  const isChatLoading = loadingContextKey === activeChatContext.key
  const hasPendingRequest = Boolean(loadingContextKey)

  useEffect(() => {
    setChatInput('')
  }, [activeChatContext.key])

  useEffect(() => {
    if (!selectedDocumentId) {
      return
    }

    const existsInCurrentResult = filteredDocuments.some(
      (document) => String(document.id) === String(selectedDocumentId),
    )

    if (!existsInCurrentResult) {
      setSelectedDocumentId(null)
    }
  }, [filteredDocuments, selectedDocumentId])

  const setChatErrorForContext = (contextKey, value) => {
    setChatErrorsByContext((current) => {
      if (!value) {
        if (!current[contextKey]) {
          return current
        }

        const next = { ...current }
        delete next[contextKey]
        return next
      }

      return {
        ...current,
        [contextKey]: value,
      }
    })
  }

  const toggleChat = () => {
    setIsChatOpen((current) => !current)
  }

  const handleSelectFolder = (folderId) => {
    setSelectedFolder(folderId)
    setSelectedDocumentId(null)
  }

  const handleSelectDocument = (documentId) => {
    setSelectedDocumentId(String(documentId))
  }

  const handleOpenDocument = (documentId) => {
    if (!documentId) {
      return
    }

    navigate(`/dashboard/process/${documentId}`)
  }

  const handleChatInputChange = (value) => {
    if (chatError) {
      setChatErrorForContext(activeChatContext.key, '')
    }

    setChatInput(value)
  }

  const handleSendMessage = async () => {
    const message = chatInput.trim()

    if (!message || hasPendingRequest) {
      return
    }

    const requestContext = {
      key: activeChatContext.key,
      type: activeChatContext.type,
      id: activeChatContext.id,
      label: activeChatContext.label,
    }

    const history = chatMessages.map((item) => ({
      role: item.role,
      content: item.content,
    }))
    const contractNumbers = []

    if (selectedDocument) {
      const processNumber = selectedDocument.processNumber || extractProcessNumberFromText(selectedDocument.title)
      if (processNumber) {
        contractNumbers.push(processNumber)
      }
    } else {
      for (const document of documentsForSelectedFolder) {
        const processNumber = document.processNumber || extractProcessNumberFromText(document.title)
        if (processNumber) {
          contractNumbers.push(processNumber)
        }
      }
    }

    updateMessagesForContext(requestContext, (currentMessages) => [
      ...currentMessages,
      createChatMessage('user', message),
    ])

    setChatInput('')
    setChatErrorForContext(requestContext.key, '')
    setLoadingContextKey(requestContext.key)

    try {
      const dedupedContractNumbers = Array.from(new Set(contractNumbers))
      const response = await sendChatMessage({
        message,
        history,
        context: requestContext,
        contractNumbers: dedupedContractNumbers,
      })

      const assistantReply = typeof response?.reply === 'string' ? response.reply.trim() : ''

      if (!assistantReply) {
        throw new Error('A IA nao retornou uma resposta em texto.')
      }

      updateMessagesForContext(requestContext, (currentMessages) => [
        ...currentMessages,
        createChatMessage('assistant', assistantReply),
      ])
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Nao foi possivel enviar sua mensagem para a IA.'

      setChatErrorForContext(requestContext.key, errorMessage)
    } finally {
      setLoadingContextKey((current) => (current === requestContext.key ? null : current))
    }
  }

  const chatContextDescription =
    activeChatContext.type === 'process'
      ? 'Historico do processo selecionado'
      : 'Historico da pasta selecionada'

  return (
    <PageGrid $chatOpen={isChatOpen}>
      <HomeSidebar activeItem={sidebarActive} onSelectItem={setSidebarActive} />
      <HomeTopbar
        isChatOpen={isChatOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onToggleChat={toggleChat}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
      <FoldersPanel
        folders={foldersWithCount}
        selectedFolder={selectedFolder}
        onSelectFolder={handleSelectFolder}
      />
      <DocumentsPanel
        folders={foldersWithCount}
        selectedFolder={selectedFolder}
        documents={filteredDocuments}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={handleSelectDocument}
        onOpenDocument={handleOpenDocument}
        viewMode={viewMode}
        totalDocuments={documentsForSelectedFolder.length}
        isLoading={isCasesLoading}
        error={casesError}
      />
      {isChatOpen ? (
        <DashboardChatSlot>
          <AssistantPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={chatMessages}
            inputValue={chatInput}
            onInputChange={handleChatInputChange}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            error={chatError}
            contextLabel={activeChatContext.label}
            contextDescription={chatContextDescription}
          />
        </DashboardChatSlot>
      ) : null}
    </PageGrid>
  )
}
