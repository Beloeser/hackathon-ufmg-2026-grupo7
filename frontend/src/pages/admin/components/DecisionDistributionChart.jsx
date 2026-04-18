import styled from 'styled-components'
import { BarChart3 } from 'lucide-react'

const ChartContainer = styled.section`
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
`

const ChartTitle = styled.h3`
  margin: 0 0 20px;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`

const BarChartContainer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 32px;
  min-height: 240px;
  padding: 16px;

  @media (max-width: 640px) {
    gap: 16px;
  }
`

const BarItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`

const Bar = styled.div`
  width: 58px;
  height: ${({ $height }) => $height}px;
  background: linear-gradient(180deg, ${({ $color }) => $color} 0%, ${({ $colorDark }) => $colorDark} 100%);
  border-radius: 8px 8px 0 0;
  transition: filter 0.2s ease, transform 0.2s ease;

  &:hover {
    filter: brightness(1.06);
    transform: translateY(-3px);
  }
`

const BarLabel = styled.p`
  margin: 0;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
`

const BarValue = styled.p`
  margin: 0;
  color: ${({ $color }) => $color};
  font-size: 20px;
  font-weight: 700;
`

const BarPercentage = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  text-align: center;
`

const LegendContainer = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 16px;
`

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 13px;
`

const LegendColor = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
`

const EmptyState = styled.div`
  color: #6b7280;
  font-size: 14px;
`

function DecisionDistributionChart({ data }) {
  if (!data) {
    return (
      <ChartContainer>
        <ChartTitle>
          <BarChart3 size={20} />
          Distribuicao de Decisoes
        </ChartTitle>
        <EmptyState>Nenhum dado disponivel</EmptyState>
      </ChartContainer>
    )
  }

  const total = data.acordo + data.defense + data.pendente
  const acordoPercentage = total > 0 ? ((data.acordo / total) * 100).toFixed(1) : 0
  const defensePercentage = total > 0 ? ((data.defense / total) * 100).toFixed(1) : 0
  const pendentePercentage = total > 0 ? ((data.pendente / total) * 100).toFixed(1) : 0

  const maxValue = Math.max(data.acordo, data.defense, data.pendente, 1)
  const scale = 180 / maxValue

  const chartData = [
    {
      label: 'Acordo',
      value: data.acordo,
      percentage: acordoPercentage,
      color: '#10b981',
      colorDark: '#059669',
    },
    {
      label: 'Defesa',
      value: data.defense,
      percentage: defensePercentage,
      color: '#f59e0b',
      colorDark: '#d97706',
    },
    {
      label: 'Pendente',
      value: data.pendente,
      percentage: pendentePercentage,
      color: '#6b7280',
      colorDark: '#4b5563',
    },
  ]

  return (
    <ChartContainer>
      <ChartTitle>
        <BarChart3 size={20} />
        Distribuicao de Decisoes
      </ChartTitle>

      <BarChartContainer>
        {chartData.map((item) => (
          <BarItem key={item.label}>
            <Bar $height={Math.max(item.value * scale, 6)} $color={item.color} $colorDark={item.colorDark} />
            <BarLabel>{item.label}</BarLabel>
            <BarValue $color={item.color}>{item.value}</BarValue>
            <BarPercentage>{item.percentage}%</BarPercentage>
          </BarItem>
        ))}
      </BarChartContainer>

      <LegendContainer>
        {chartData.map((item) => (
          <LegendItem key={item.label}>
            <LegendColor $color={item.color} />
            <span>
              {item.label}: {item.value} casos ({item.percentage}%)
            </span>
          </LegendItem>
        ))}
      </LegendContainer>
    </ChartContainer>
  )
}

export default DecisionDistributionChart
