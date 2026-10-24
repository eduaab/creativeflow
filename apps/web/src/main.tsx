import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/poppins/800.css';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AdminPage } from './pages/Admin';
import { ApprovalsPage } from './pages/Approvals';
import { CampaignPage } from './pages/Campaign';
import { CampaignsPage } from './pages/Campaigns';
import { CatalogPage } from './pages/Catalog';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { NewCampaignPage } from './pages/NewCampaign';
import { StudioPage } from './pages/Studio';

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 5_000 } } });

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/entrar" replace />;
  return <Layout />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<LoginPage />} />
              <Route element={<Protected />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/campanhas" element={<CampaignsPage />} />
                <Route path="/campanhas/nova" element={<NewCampaignPage />} />
                <Route path="/campanhas/:id" element={<CampaignPage />} />
                <Route path="/pecas/:id" element={<StudioPage />} />
                <Route path="/aprovacoes" element={<ApprovalsPage />} />
                <Route path="/catalogo" element={<CatalogPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
