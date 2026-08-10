import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginForm } from '../features/auth/components/LoginForm';
import { OnboardingWizard } from '../features/auth/components/OnboardingWizard';
import { AuthSuccess } from '../features/auth/components/AuthSuccess';
import { BusinessOnboardingQuiz } from '../features/auth/components/BusinessOnboardingQuiz';
import { DashboardContainer } from '../features/dashboard/components/DashboardContainer';
import { ChatContainer } from '../features/copilot';
import { MainLayout } from '../components/layout/MainLayout';
import { KnowledgeManager } from '../features/knowledge/components/KnowledgeManager';
import { AgentSettings } from '../features/settings/components/AgentSettings';
import { WeeklyReportViewer } from '../features/reports/components/WeeklyReportViewer';
import { BillingPage } from '../pages/BillingPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<OnboardingWizard />} />
      <Route path="/auth-success" element={<AuthSuccess />} />


      {/* Rotas Privadas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<BusinessOnboardingQuiz />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/dashboard" element={<DashboardContainer />} />
          <Route path="/chat" element={<ChatContainer />} />
          <Route path="/knowledge" element={<KnowledgeManager />} />
          <Route path="/agent-settings" element={<AgentSettings />} />
          <Route path="/reports" element={<WeeklyReportViewer />} />
          <Route path="/settings/billing" element={<BillingPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
