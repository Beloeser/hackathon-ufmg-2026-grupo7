import { useState } from 'react'
import {
  Search,
  Filter,
  LayoutGrid,
  LayoutList,
  MessageSquare,
  Settings,
  Folder,
  FileText,
  Clock,
  TrendingUp,
  User,
  Sparkles,
} from 'lucide-react'

export default function HomeScreen() {
  const [selectedFolder, setSelectedFolder] = useState(0)
  const [viewMode, setViewMode] = useState('list')
  const [isChatOpen, setIsChatOpen] = useState(true)

  const folders = [
    { id: 0, name: 'Processos Ativos', count: 24, icon: Folder },
    { id: 1, name: 'Em Análise', count: 8, icon: TrendingUp },
    { id: 2, name: 'Aguardando Decisão', count: 12, icon: Clock },
    { id: 3, name: 'Arquivados', count: 156, icon: FileText },
    { id: 4, name: 'Urgentes', count: 3, icon: Sparkles },
  ]

  const documents = [
    { id: 1, title: 'Processo 0001234-56.2026.8.26.0100', type: 'Ação Civil Pública', date: '15/04/2026', status: 'Em andamento' },
    { id: 2, title: 'Processo 0007890-12.2026.8.26.0224', type: 'Recurso de Apelação', date: '14/04/2026', status: 'Aguardando análise' },
    { id: 3, title: 'Processo 0003456-78.2026.8.26.0587', type: 'Petição Inicial', date: '12/04/2026', status: 'Protocolado' },
    { id: 4, title: 'Processo 0009876-54.2026.8.26.0344', type: 'Mandado de Segurança', date: '10/04/2026', status: 'Em andamento' },
    { id: 5, title: 'Processo 0002468-13.2026.8.26.0176', type: 'Ação Trabalhista', date: '08/04/2026', status: 'Audiência agendada' },
  ]

  return (
    <div className="size-full flex bg-[#FAFAFA]">
      <div className="w-16 bg-[#0A0A0A] flex flex-col items-center py-6 gap-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5B443] to-[#EAB308] flex items-center justify-center">
          <User className="w-5 h-5 text-black" />
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <button className="w-10 h-10 rounded-lg bg-[#F5B443] flex items-center justify-center text-black hover:bg-[#EAB308] transition-colors">
            <MessageSquare className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-[#1A1A1A] hover:text-[#F5B443] transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar processos, documentos..."
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5B443] focus:border-transparent"
              />
            </div>

            <button className="h-10 px-4 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2 transition-colors">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Filtros</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#F5B443] text-black' : 'hover:bg-gray-200 text-gray-700'}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[#F5B443] text-black' : 'hover:bg-gray-200 text-gray-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="h-10 px-4 rounded-lg bg-[#F5B443] text-black hover:bg-[#EAB308] flex items-center gap-2 transition-all shadow-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">IA Chat</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
            <div className="px-4 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Pastas</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors border-l-2 ${
                    selectedFolder === folder.id
                      ? 'bg-[#FFF9E6] border-[#F5B443]'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <folder.icon className={`w-5 h-5 ${selectedFolder === folder.id ? 'text-[#F5B443]' : 'text-gray-400'}`} />
                  <div className="flex-1 text-left">
                    <div className={`text-sm ${selectedFolder === folder.id ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                      {folder.name}
                    </div>
                  </div>
                  <div
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedFolder === folder.id
                        ? 'bg-[#F5B443] text-black font-medium'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {folder.count}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                {folders.find((folder) => folder.id === selectedFolder)?.name}
              </h1>
              <p className="text-sm text-gray-500">
                {documents.length}
                {' '}
                processos encontrados
              </p>
            </div>

            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-[#F5B443] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{doc.title}</h3>
                      <p className="text-sm text-gray-600">{doc.type}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFF9E6] text-[#B8860B] font-medium border border-[#F5B443]">
                      {doc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {doc.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isChatOpen && (
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
              <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F5B443] to-[#EAB308] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Assistente IA</h2>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F5B443] to-[#EAB308] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <p className="text-sm text-gray-800">
                        Olá! Sou seu assistente jurídico inteligente. Como posso ajudá-lo hoje?
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <div className="flex-1 max-w-[80%]">
                    <div className="bg-[#0A0A0A] rounded-lg px-4 py-3">
                      <p className="text-sm text-white">
                        Pode analisar o Processo 0001234-56.2026?
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F5B443] to-[#EAB308] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <p className="text-sm text-gray-800 mb-2">
                        Analisando o processo... Aqui está um resumo:
                      </p>
                      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                        <li>Tipo: Ação Civil Pública</li>
                        <li>Status: Em andamento</li>
                        <li>Próxima audiência: 22/04/2026</li>
                        <li>Recomendação: Revisar documentação anexa</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite sua mensagem..."
                    className="flex-1 h-10 px-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5B443] focus:border-transparent"
                  />
                  <button className="w-10 h-10 rounded-lg bg-[#F5B443] hover:bg-[#EAB308] flex items-center justify-center text-black transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
