import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Layout } from "./components/Layout"
import { LoginPage } from "./pages/Auth/Login"
import { RegisterPage } from "./pages/Auth/Register"
import { DashboardPage } from "./pages/Dashboard/Dashboard"
import { ClientsListPage } from "./pages/Clients/ClientsList"
import { ClientDetailPage } from "./pages/Clients/ClientDetail"
import { ClientEditPage } from "./pages/Clients/ClientEdit"
import { ScansListPage } from "./pages/Scans/ScansList"
import { ScanDetailPage } from "./pages/Scans/ScanDetail"
import { ReportsListPage } from "./pages/Reports/ReportsList"
import { ReportDetailPage } from "./pages/Reports/ReportDetail"

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/clients" element={<Protected><ClientsListPage /></Protected>} />
          <Route path="/clients/:id" element={<Protected><ClientDetailPage /></Protected>} />
          <Route path="/clients/:id/edit" element={<Protected><ClientEditPage /></Protected>} />
          <Route path="/scans" element={<Protected><ScansListPage /></Protected>} />
          <Route path="/scans/:id" element={<Protected><ScanDetailPage /></Protected>} />
          <Route path="/reports" element={<Protected><ReportsListPage /></Protected>} />
          <Route path="/reports/:id" element={<Protected><ReportDetailPage /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
