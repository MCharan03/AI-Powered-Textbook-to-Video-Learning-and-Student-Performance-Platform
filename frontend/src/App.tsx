import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './lib/authContext';
import { HeaderBar } from './components/HeaderBar';
import { SidebarNav } from './components/SidebarNav';
import { Login } from './pages/Login';

// Admin views
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminPipeline } from './pages/admin/AdminPipeline';
import { AdminHierarchy } from './pages/admin/AdminHierarchy';
import { AdminReview } from './pages/admin/AdminReview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSettings } from './pages/admin/AdminSettings';

// Learning views
import { StudentDashboard } from './pages/learn/StudentDashboard';
import { StudentVideoPlayer } from './pages/learn/StudentVideoPlayer';
import { StudentQuiz } from './pages/learn/StudentQuiz';
import { StudentAdaptiveQuiz } from './pages/learn/StudentAdaptiveQuiz';
import { StudentMastery } from './pages/learn/StudentMastery';
import { ReadOnlyDashboard } from './pages/learn/ReadOnlyDashboard';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<string>('');

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setRoute('admin-dashboard');
      } else if (user.role === 'teacher' || user.role === 'parent') {
        setRoute('readonly-dashboard');
      } else {
        setRoute('student-dashboard');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading platform environment...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const getBreadcrumbs = () => {
    const portal = user.role === 'admin' ? 'Admin Portal' : 'Learning Portal';
    let current = 'Dashboard';
    switch (route) {
      case 'admin-dashboard':
        current = 'Ingestion & Overview';
        break;
      case 'admin-pipeline':
        current = 'AI Pipeline Monitor';
        break;
      case 'admin-hierarchy':
        current = 'Extracted Hierarchy';
        break;
      case 'admin-review':
        current = 'Review Queue & Approval Gate';
        break;
      case 'admin-users':
        current = 'User Governance';
        break;
      case 'admin-settings':
        current = 'Mastery Settings';
        break;
      case 'student-dashboard':
        current = 'Student Overview';
        break;
      case 'student-video':
        current = 'Pre-Rendered Video Lessons';
        break;
      case 'student-quiz':
        current = 'Topic Quizzes';
        break;
      case 'student-adaptive':
        current = 'Stage 6 Adaptive Practice';
        break;
      case 'student-mastery':
        current = 'Mastery Analytics';
        break;
      case 'readonly-dashboard':
        current = 'Observer Summary';
        break;
    }
    return [portal, current];
  };

  const renderContent = () => {
    switch (route) {
      // Admin Portal
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={setRoute} />;
      case 'admin-pipeline':
        return <AdminPipeline />;
      case 'admin-hierarchy':
        return <AdminHierarchy />;
      case 'admin-review':
        return <AdminReview />;
      case 'admin-users':
        return <AdminUsers />;
      case 'admin-settings':
        return <AdminSettings />;

      // Learning Portal (Student)
      case 'student-dashboard':
        return <StudentDashboard onNavigate={setRoute} />;
      case 'student-video':
        return <StudentVideoPlayer onNavigate={setRoute} />;
      case 'student-quiz':
        return <StudentQuiz onNavigate={setRoute} />;
      case 'student-adaptive':
        return <StudentAdaptiveQuiz onNavigate={setRoute} />;
      case 'student-mastery':
        return <StudentMastery onNavigate={setRoute} />;

      // Learning Portal (Teacher / Parent)
      case 'readonly-dashboard':
        return <ReadOnlyDashboard />;

      default:
        return <div>Route not found</div>;
    }
  };

  return (
    <div className="app-container">
      <SidebarNav currentRoute={route} onRouteChange={setRoute} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <HeaderBar breadcrumbs={getBreadcrumbs()} />
        <main className="main-content">{renderContent()}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
