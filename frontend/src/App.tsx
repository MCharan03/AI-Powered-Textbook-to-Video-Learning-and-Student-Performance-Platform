import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './lib/authContext';
import { HeaderBar } from './components/HeaderBar';
import { SidebarNav } from './components/SidebarNav';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';

// Admin views
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminPipeline } from './pages/admin/AdminPipeline';
import { AdminHierarchy } from './pages/admin/AdminHierarchy';
import { AdminReview } from './pages/admin/AdminReview';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminStudents } from './pages/admin/AdminStudents';
import { AdminParents } from './pages/admin/AdminParents';
import { AdminTeachers } from './pages/admin/AdminTeachers';
import { AdminSubjects } from './pages/admin/AdminSubjects';
import { AdminChapterDetail } from './pages/admin/AdminChapterDetail';
import { AdminTopicDetail } from './pages/admin/AdminTopicDetail';
import { AdminSubtopicDetail } from './pages/admin/AdminSubtopicDetail';
import { AdminTextbooks } from './pages/admin/AdminTextbooks';
import { AdminTextbookReview } from './pages/admin/AdminTextbookReview';
import { AdminVideoPlans } from './pages/admin/AdminVideoPlans';
import { AdminScriptReview } from './pages/admin/AdminScriptReview';
import { AdminVideoReview } from './pages/admin/AdminVideoReview';
import { AdminQuizzes } from './pages/admin/AdminQuizzes';

// Learning views
import { StudentDashboard } from './pages/learn/StudentDashboard';
import { StudentVideoPlayer } from './pages/learn/StudentVideoPlayer';
import { StudentQuiz } from './pages/learn/StudentQuiz';
import { StudentAdaptiveQuiz } from './pages/learn/StudentAdaptiveQuiz';
import { StudentMastery } from './pages/learn/StudentMastery';
import { ReadOnlyDashboard } from './pages/learn/ReadOnlyDashboard';
import { ParentDashboard } from './pages/learn/ParentDashboard';
import { TeacherAssignments } from './pages/learn/TeacherAssignments';
import { StudentAssignments } from './pages/learn/StudentAssignments';

const isCurrentAppAdmin = (): boolean => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    // Hostname-based detection:
    // Production: admin.veyoralabs.net
    // Localhost dev: admin.localhost or host starting with admin.
    if (host === 'admin.veyoralabs.net' || host.startsWith('admin.')) {
      return true;
    }
    // Environment variable for local dev/build: VITE_APP_PORTAL=admin
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv?.VITE_APP_PORTAL === 'admin') {
      return true;
    }
  }
  return false;
};

const MainLayout: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const isAdminPortal = isCurrentAppAdmin();
  const [route, setRoute] = useState<string>('');
  const [routeParams, setRouteParams] = useState<any>({});

  const handleNavigate = (newRoute: string, params?: any) => {
    if (!user) return;

    // Strict RBAC routing guard
    let resolvedRoute = newRoute;
    if (user.role === 'admin') {
      if (!resolvedRoute.startsWith('admin-')) {
        resolvedRoute = 'admin-dashboard';
      }
    } else if (user.role === 'student') {
      const allowedStudentRoutes = [
        'student-dashboard',
        'student-assignments',
        'student-video',
        'student-quiz',
        'student-adaptive',
        'student-mastery',
      ];
      if (!allowedStudentRoutes.includes(resolvedRoute)) {
        resolvedRoute = 'student-dashboard';
      }
    } else if (user.role === 'parent') {
      if (resolvedRoute !== 'parent-dashboard') {
        resolvedRoute = 'parent-dashboard';
      }
    } else if (user.role === 'teacher') {
      const allowedTeacherRoutes = [
        'readonly-dashboard',
        'teacher-assignments',
      ];
      if (!allowedTeacherRoutes.includes(resolvedRoute)) {
        resolvedRoute = 'readonly-dashboard';
      }
    }

    if (params) {
      setRouteParams((prev: any) => ({ ...prev, ...params }));
    }
    setRoute(resolvedRoute);
  };

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setRoute('admin-dashboard');
      } else if (user.role === 'parent') {
        setRoute('parent-dashboard');
      } else if (user.role === 'teacher') {
        setRoute('readonly-dashboard');
      } else {
        setRoute('student-dashboard');
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D16', color: '#94A3B8' }}>
        Loading platform environment...
      </div>
    );
  }

  // Not logged in: Render dedicated login according to application domain / environment
  if (!user) {
    if (isAdminPortal) {
      return <AdminLogin />;
    }
    return <Login />;
  }

  // Cross-application protection
  if (isAdminPortal && user.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090A10', color: '#F8FAFC', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '20px', color: '#EF4444', marginBottom: '8px' }}>Access Denied — Administrator Portal</h2>
        <p style={{ color: '#94A3B8', maxWidth: '440px', lineHeight: 1.5, marginBottom: '20px' }}>
          This portal is strictly restricted to institutional administrators. Student, Parent, and Teacher accounts belong on <strong>learn.veyoralabs.net</strong>.
        </p>
        <button
          onClick={logout}
          style={{ padding: '10px 18px', backgroundColor: '#334155', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (!isAdminPortal && user.role === 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D16', color: '#F8FAFC', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '20px', color: '#6366F1', marginBottom: '8px' }}>Administrator Session Detected</h2>
        <p style={{ color: '#94A3B8', maxWidth: '440px', lineHeight: 1.5, marginBottom: '20px' }}>
          Administrator accounts are managed exclusively on <strong>admin.veyoralabs.net</strong> and cannot access the Student/Parent/Teacher learning application.
        </p>
        <button
          onClick={logout}
          style={{ padding: '10px 18px', backgroundColor: '#334155', color: '#FFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  const getBreadcrumbs = () => {
    const portal = isAdminPortal ? 'Admin Portal' : 'Learning Portal';
    let current = 'Dashboard';
    switch (route) {

      case 'admin-dashboard':
        current = 'Ingestion & Overview';
        break;
      case 'admin-students':
        current = 'Students Governance';
        break;
      case 'admin-parents':
        current = 'Parents Governance';
        break;
      case 'admin-teachers':
        current = 'Teachers Governance';
        break;
      case 'admin-subjects':
        current = 'Academic Subjects';
        break;
      case 'admin-chapters':
      case 'admin-chapter-detail':
        current = 'Chapter Curriculum Detail';
        break;
      case 'admin-topics':
      case 'admin-topic-detail':
        current = 'Topic Detail';
        break;
      case 'admin-subtopics':
      case 'admin-subtopic-detail':
        current = 'Subtopic Detail';
        break;
      case 'admin-textbooks':
        current = 'Textbooks & Ingestion';
        break;
      case 'admin-textbook-review':
        current = 'Textbook Curriculum Review';
        break;
      case 'admin-video-plans':
        current = 'Video Plan Generation & Review';
        break;
      case 'admin-script-review':
        current = 'Educational Script Review & Verification';
        break;
      case 'admin-video-review':
        current = 'Video Rendering & Final Review';
        break;
      case 'admin-quizzes':
        current = 'Interactive Quiz Generation & Review';
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
      case 'student-assignments':
        current = 'Assignments & Submissions';
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
      case 'parent-dashboard':
        current = "My Child's Learning";
        break;
      case 'readonly-dashboard':
        current = user?.role === 'teacher' ? 'My Students & Class Performance' : 'Academic Observer Summary';
        break;
      case 'teacher-assignments':
        current = 'Assignment Management';
        break;
    }
    return [portal, current];
  };

  const renderContent = () => {
    switch (route) {
      // Admin Portal - BUILD 02 User & Academic Management
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={handleNavigate} />;
      case 'admin-students':
        return <AdminStudents onNavigate={handleNavigate} selectedStudentId={routeParams.studentId} />;
      case 'admin-parents':
        return <AdminParents onNavigate={handleNavigate} selectedParentId={routeParams.parentId} />;
      case 'admin-teachers':
        return <AdminTeachers onNavigate={handleNavigate} selectedTeacherId={routeParams.teacherId} />;
      case 'admin-subjects':
        return <AdminSubjects onNavigate={handleNavigate} selectedSubjectId={routeParams.subjectId} />;
      case 'admin-chapters':
      case 'admin-chapter-detail':
        return <AdminChapterDetail chapterId={routeParams.chapterId} onNavigate={handleNavigate} />;
      case 'admin-topics':
      case 'admin-topic-detail':
        return <AdminTopicDetail topicId={routeParams.topicId} onNavigate={handleNavigate} />;
      case 'admin-subtopics':
      case 'admin-subtopic-detail':
        return <AdminSubtopicDetail subtopicId={routeParams.subtopicId} onNavigate={handleNavigate} />;

      // Admin Portal - BUILD 03 Textbook Ingestion & Extraction
      case 'admin-textbooks':
        return <AdminTextbooks onNavigate={handleNavigate} />;
      case 'admin-textbook-review':
        return <AdminTextbookReview textbookId={routeParams.textbookId} onNavigate={handleNavigate} />;

      // Admin Portal - BUILD 04 Video Plan Generation & Review
      case 'admin-video-plans':
        return <AdminVideoPlans onNavigate={handleNavigate} initialTopicId={routeParams.topicId} />;

      // Admin Portal - BUILD 05 Educational Script Review
      case 'admin-script-review':
        return <AdminScriptReview onNavigate={handleNavigate} initialVideoId={routeParams.videoId} />;

      // Admin Portal - BUILD 06 Video Review & Publishing
      case 'admin-video-review':
        return <AdminVideoReview />;

      // Admin Portal - BUILD 07 Interactive Quiz Review
      case 'admin-quizzes':
        return <AdminQuizzes />;

      // Admin Portal - Pipeline, Review, Settings
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
        return <StudentDashboard onNavigate={handleNavigate} />;
      case 'student-assignments':
        return <StudentAssignments onNavigate={handleNavigate} />;
      case 'student-video':
        return <StudentVideoPlayer onNavigate={handleNavigate} videoId={routeParams.videoId} />;
      case 'student-quiz':
        return <StudentQuiz onNavigate={handleNavigate} quizId={routeParams.quizId} topicId={routeParams.topicId} />;
      case 'student-adaptive':
        return <StudentAdaptiveQuiz onNavigate={handleNavigate} topicId={routeParams.topicId} />;
      case 'student-mastery':
        return <StudentMastery onNavigate={handleNavigate} />;

      // Learning Portal (Parent)
      case 'parent-dashboard':
        return <ParentDashboard />;

      // Learning Portal (Teacher)
      case 'readonly-dashboard':
        return <ReadOnlyDashboard onNavigate={handleNavigate} />;
      case 'teacher-assignments':
        return <TeacherAssignments />;

      default:
        return (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
            <h3>Route not found</h3>
            <button
              onClick={() => handleNavigate(
                user.role === 'admin'
                  ? 'admin-dashboard'
                  : (user.role === 'parent'
                    ? 'parent-dashboard'
                    : (user.role === 'teacher' ? 'readonly-dashboard' : 'student-dashboard'))
              )}
              style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '6px', backgroundColor: '#3B82F6', color: '#FFF', border: 'none', cursor: 'pointer' }}
            >
              Return to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="app-container">
      <SidebarNav currentRoute={route} onRouteChange={(r) => handleNavigate(r)} />
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
