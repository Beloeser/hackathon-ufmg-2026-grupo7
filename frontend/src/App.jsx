import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Rotas serão adicionadas aqui */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App
