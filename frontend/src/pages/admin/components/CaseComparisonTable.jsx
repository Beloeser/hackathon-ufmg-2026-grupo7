import { useState } from 'react'
import styled from 'styled-components'
import { CheckCircle, XCircle, Clock3 } from 'lucide-react'

const TableWrapper = styled.section`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
`

const FilterContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
`

const FilterButton = styled.button`
  border: 1px solid ${({ $active }) => ($active ? '#ffb300' : '#d1d5db')};
  border-radius: 10px;
  background: ${({ $active }) => ($active ? '#ffb300' : '#ffffff')};
  color: ${({ $active }) => ($active ? '#111827' : '#4b5563')};
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.2s ease;

  &:hover {
    background: ${({ $active }) => ($active ? '#e6a200' : '#f3f4f6')};
  }
`

const ScrollRegion = styled.div`
  max-height: 560px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #e5e7eb;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #9ca3af;
  }
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  th {
    padding: 14px 16px;
    text-align: left;
    color: #6b7280;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 13px;
    vertical-align: middle;
  }

  tbody tr:hover {
    background: #f9fafb;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
`

const ProcessNumber = styled.span`
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
`

const Subject = styled.span`
  display: block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const LawyerName = styled.span`
  color: #111827;
  font-weight: 500;
`

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 5px 10px;
  background: ${({ $type }) => {
    if ($type === 'match') return '#dcfce7'
    if ($type === 'mismatch') return '#fee2e2'
    return '#e5e7eb'
  }};
  color: ${({ $type }) => {
    if ($type === 'match') return '#166534'
    if ($type === 'mismatch') return '#991b1b'
    return '#374151'
  }};
  font-size: 12px;
  font-weight: 600;

  svg {
    width: 14px;
    height: 14px;
  }
`

const CurrencyValue = styled.span`
  color: ${({ $positive }) => ($positive ? '#10b981' : '#6b7280')};
  font-size: 12px;
  font-weight: 600;
`

const ConfidenceTag = styled.span`
  display: inline-block;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 600;
`

const EmptyMessage = styled.div`
  padding: 40px 16px;
  color: #6b7280;
  font-size: 14px;
  text-align: center;
`

function resolveMatchType(matchesModel) {
  if (matchesModel === true) return 'match'
  if (matchesModel === false) return 'mismatch'
  return 'pending'
}

function resolveMatchLabel(matchesModel) {
  if (matchesModel === true) return 'Sim'
  if (matchesModel === false) return 'Nao'
  return 'Pendente'
}

function CaseComparisonTable({ data }) {
  const [filter, setFilter] = useState('all')

  if (!data || data.length === 0) {
    return (
      <TableWrapper>
        <EmptyMessage>Nenhum dado de comparacao disponivel</EmptyMessage>
      </TableWrapper>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const filteredData = data.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'match') return item.matchesModel === true
    if (filter === 'mismatch') return item.matchesModel === false
    if (filter === 'pending') return item.matchesModel === null
    return true
  })

  const matchCount = data.filter((item) => item.matchesModel === true).length
  const mismatchCount = data.filter((item) => item.matchesModel === false).length
  const pendingCount = data.filter((item) => item.matchesModel === null).length

  return (
    <TableWrapper>
      <FilterContainer>
        <FilterButton type="button" $active={filter === 'all'} onClick={() => setFilter('all')}>
          Todos ({data.length})
        </FilterButton>
        <FilterButton type="button" $active={filter === 'match'} onClick={() => setFilter('match')}>
          Seguiram ({matchCount})
        </FilterButton>
        <FilterButton type="button" $active={filter === 'mismatch'} onClick={() => setFilter('mismatch')}>
          Nao seguiram ({mismatchCount})
        </FilterButton>
        <FilterButton type="button" $active={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pendentes ({pendingCount})
        </FilterButton>
      </FilterContainer>

      <ScrollRegion>
        <Table>
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Processo</th>
              <th style={{ width: '15%' }}>Assunto</th>
              <th style={{ width: '12%' }}>Advogado</th>
              <th style={{ width: '10%' }}>Modelo</th>
              <th style={{ width: '8%' }}>Confianca</th>
              <th style={{ width: '10%' }}>Advogado</th>
              <th style={{ width: '10%' }}>Aderencia</th>
              <th style={{ width: '13%' }}>Impacto</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((comparison, index) => {
              const matchType = resolveMatchType(comparison.matchesModel)
              const isPositive = comparison.moneySaved > 0

              return (
                <tr key={`${comparison.processNumber}-${index}`}>
                  <td>
                    <ProcessNumber>{comparison.processNumber}</ProcessNumber>
                  </td>
                  <td>
                    <Subject title={comparison.subject}>{comparison.subject}</Subject>
                  </td>
                  <td>
                    <LawyerName>{comparison.lawyerName}</LawyerName>
                  </td>
                  <td>{comparison.modelSuggestion}</td>
                  <td>
                    <ConfidenceTag>{comparison.modelConfidence}%</ConfidenceTag>
                  </td>
                  <td>{comparison.lawyerChoice}</td>
                  <td>
                    <Badge $type={matchType}>
                      {comparison.matchesModel === true && <CheckCircle />}
                      {comparison.matchesModel === false && <XCircle />}
                      {comparison.matchesModel === null && <Clock3 />}
                      {resolveMatchLabel(comparison.matchesModel)}
                    </Badge>
                  </td>
                  <td>
                    <CurrencyValue $positive={isPositive}>
                      {isPositive ? `+${formatCurrency(comparison.moneySaved)}` : formatCurrency(comparison.moneySaved)}
                    </CurrencyValue>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </ScrollRegion>
    </TableWrapper>
  )
}

export default CaseComparisonTable
