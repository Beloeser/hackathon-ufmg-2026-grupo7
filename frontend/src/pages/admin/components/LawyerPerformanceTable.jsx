import styled from 'styled-components'
import { TrendingUp, TrendingDown, Award } from 'lucide-react'

const TableWrapper = styled.section`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  thead {
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
  }

  td {
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 13px;
  }

  tbody tr:hover {
    background: #f9fafb;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }
`

const LawyerName = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #111827;
  font-weight: 600;
`

const AwardIcon = styled.span`
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #fbbf24;
  color: #78350f;
`

const PercentageBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 5px 10px;
  background: ${({ $percentage }) => {
    if ($percentage >= 75) return '#dcfce7'
    if ($percentage >= 50) return '#fef3c7'
    return '#fee2e2'
  }};
  color: ${({ $percentage }) => {
    if ($percentage >= 75) return '#166534'
    if ($percentage >= 50) return '#92400e'
    return '#991b1b'
  }};
  font-size: 12px;
  font-weight: 600;

  svg {
    width: 14px;
    height: 14px;
  }
`

const MoneySaved = styled.span`
  color: #10b981;
  font-size: 12px;
  font-weight: 600;
`

const CaseCount = styled.span`
  display: inline-block;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
`

const EmptyMessage = styled.div`
  padding: 40px 16px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
`

function LawyerPerformanceTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <TableWrapper>
        <EmptyMessage>Nenhum dado de desempenho disponivel</EmptyMessage>
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

  const getPercentageIcon = (percentage) => {
    if (percentage >= 50) return TrendingUp
    return TrendingDown
  }

  const sortedData = [...data].sort((a, b) => {
    const aPercentage = parseFloat(a.adherencePercentage)
    const bPercentage = parseFloat(b.adherencePercentage)
    return bPercentage - aPercentage
  })

  return (
    <TableWrapper>
      <Table>
        <thead>
          <tr>
            <th style={{ width: '28%' }}>Advogado</th>
            <th style={{ width: '14%' }}>Casos totais</th>
            <th style={{ width: '14%' }}>Casos decididos</th>
            <th style={{ width: '20%' }}>Aderencia</th>
            <th style={{ width: '12%' }}>Seguiu modelo</th>
            <th style={{ width: '12%' }}>Economia</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((lawyer, index) => {
            const percentage = parseFloat(lawyer.adherencePercentage)
            const PercentageIcon = getPercentageIcon(percentage)

            return (
              <tr key={lawyer.lawyerId || index}>
                <td>
                  <LawyerName>
                    {index === 0 && <AwardIcon><Award size={12} /></AwardIcon>}
                    {lawyer.lawyerName}
                  </LawyerName>
                </td>
                <td>
                  <CaseCount>{lawyer.totalCases}</CaseCount>
                </td>
                <td>
                  <CaseCount>{lawyer.decidedCases || 0}</CaseCount>
                </td>
                <td>
                  <PercentageBadge $percentage={percentage}>
                    <PercentageIcon />
                    {percentage.toFixed(1)}%
                  </PercentageBadge>
                </td>
                <td>{lawyer.followedModelCount} casos</td>
                <td>
                  <MoneySaved>{formatCurrency(lawyer.totalMoneySaved)}</MoneySaved>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableWrapper>
  )
}

export default LawyerPerformanceTable
