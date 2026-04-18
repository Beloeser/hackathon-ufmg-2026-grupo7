import styled from 'styled-components'

const Topbar = styled.header`
  grid-row: 1;
  grid-column: 2;
  display: flex;
  min-height: 0;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 0 32px;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
`

const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Title = styled.h1`
  margin: 0;
  color: #111827;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
`

const Subtitle = styled.p`
  margin: 0;
  color: #6b7280;
  font-size: 13px;
`

function AdminTopbar() {
  return (
    <Topbar>
      <Left>
        <Title>Dashboard Administrativo</Title>
        <Subtitle>Analise de desempenho e recomendacoes do modelo</Subtitle>
      </Left>
    </Topbar>
  )
}

export default AdminTopbar
