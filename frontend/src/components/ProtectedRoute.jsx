import { Navigate } from 'react-router-dom'
import styled from 'styled-components'

const UnauthorizedContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`

const UnauthorizedCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
`

const ErrorIcon = styled.div`
  font-size: 64px;
  margin-bottom: 16px;
`

const ErrorTitle = styled.h1`
  margin: 0 0 12px 0;
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
`

const ErrorMessage = styled.p`
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #666;
`

const ReturnButton = styled.button`
  background: #6366f1;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #4f46e5;
    transform: translateY(-2px);
  }
`

function ProtectedRoute({ children, requiredRole = null }) {
  const userStr = localStorage.getItem('user')

  // If no user is logged in, redirect to login
  if (!userStr) {
    return <Navigate to="/login" replace />
  }

  try {
    const user = JSON.parse(userStr)

    // If a specific role is required, check if user has that role
    if (requiredRole && user.role !== requiredRole) {
      return (
        <UnauthorizedContainer>
          <UnauthorizedCard>
            <ErrorIcon>🔒</ErrorIcon>
            <ErrorTitle>Acesso Negado</ErrorTitle>
            <ErrorMessage>
              Você não tem permissão para acessar esta página. Apenas administradores podem acessar o painel administrativo.
            </ErrorMessage>
            <ReturnButton onClick={() => (window.location.href = '/dashboard')}>
              Voltar para Dashboard
            </ReturnButton>
          </UnauthorizedCard>
        </UnauthorizedContainer>
      )
    }

    // User is authorized, render the component
    return children
  } catch (error) {
    console.error('Error parsing user from localStorage:', error)
    return <Navigate to="/login" replace />
  }
}

export default ProtectedRoute
