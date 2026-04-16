import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import Servers from './pages/Servers'
import Classes from './pages/Classes'
import Moderation from './pages/Moderation'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/common/ProtectedRoute'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/:id" element={<PlayerDetail />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/moderation" element={
              <ProtectedRoute roles={['admin','teacher']}><Moderation /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>
            } />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
