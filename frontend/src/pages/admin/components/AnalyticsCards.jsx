import styled from 'styled-components'
import { BarChart3, DollarSign, CheckCircle } from 'lucide-react'

const CardsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`

const Card = styled.article`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
`

const CardContent = styled.div`
  flex: 1;
  min-width: 0;
`

const CardLabel = styled.p`
  margin: 0 0 8px;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`

const CardValue = styled.p`
  margin: 0;
  color: #111827;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
`

const CardSubtext = styled.p`
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
`

const IconWrapper = styled.div`
  display: inline-flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: ${({ $bgColor }) => $bgColor};
  color: #ffffff;
`

function AnalyticsCards({ data }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const comparedCases = data.comparedCases || 0
  return (
    <CardsContainer>
      <Card>
        <CardContent>
          <CardLabel>Casos Totais</CardLabel>
          <CardValue>{data.totalCases}</CardValue>
          <CardSubtext>Volume monitorado no dashboard</CardSubtext>
        </CardContent>
        <IconWrapper $bgColor="#6366f1">
          <BarChart3 size={24} />
        </IconWrapper>
      </Card>

      <Card>
        <CardContent>
          <CardLabel>Aderencia ao Modelo</CardLabel>
          <CardValue>{data.adherencePercentage}%</CardValue>
          <CardSubtext>{data.lawyerFollowedModel} de {comparedCases} casos decididos</CardSubtext>
        </CardContent>
        <IconWrapper $bgColor="#10b981">
          <CheckCircle size={24} />
        </IconWrapper>
      </Card>

      <Card>
        <CardContent>
          <CardLabel>Economia Total</CardLabel>
          <CardValue>{formatCurrency(data.totalMoneySaved)}</CardValue>
          <CardSubtext>Nos casos em que houve convergencia</CardSubtext>
        </CardContent>
        <IconWrapper $bgColor="#f59e0b">
          <DollarSign size={24} />
        </IconWrapper>
      </Card>
    </CardsContainer>
  )
}

export default AnalyticsCards
