import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import PrivateRoute from './components/PrivateRoute'
import CookieBanner from './components/CookieBanner'
import PageLoader from './components/PageLoader'
import Home from './pages/Home'

// Все остальные страницы — lazy: грузятся отдельными чанками по требованию.
const About       = lazy(() => import('./pages/About'))
const Schedule    = lazy(() => import('./pages/Schedule'))
const Calendar    = lazy(() => import('./pages/Calendar'))
const Apply       = lazy(() => import('./pages/Apply'))
const Login       = lazy(() => import('./pages/Login'))
const Register    = lazy(() => import('./pages/Register'))
const Cabinet     = lazy(() => import('./pages/Cabinet'))
const GroupKids1  = lazy(() => import('./pages/GroupKids1'))
const GroupKids2  = lazy(() => import('./pages/GroupKids2'))
const GroupAdults = lazy(() => import('./pages/GroupAdults'))
const Champions   = lazy(() => import('./pages/Champions'))
const Privacy     = lazy(() => import('./pages/Privacy'))
const Quiz        = lazy(() => import('./pages/Quiz'))
const NewsPage    = lazy(() => import('./pages/News'))
const WhyTaipan   = lazy(() => import('./pages/WhyTaipan'))
const InvitePage  = lazy(() => import('./pages/InvitePage'))
const Preparation = lazy(() => import('./pages/preparation/Preparation'))
const Gallery     = lazy(() => import('./pages/preparation/Gallery'))
const Methodichka = lazy(() => import('./pages/preparation/Methodichka'))
const Plan        = lazy(() => import('./pages/preparation/Plan'))

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/about"             element={<About />} />
          <Route path="/schedule"          element={<Schedule />} />
          <Route path="/calendar"          element={<Calendar />} />
          <Route path="/apply"             element={<Apply />} />
          <Route path="/login"             element={<Login />} />
          <Route path="/register"          element={<Register />} />
          <Route path="/cabinet"           element={<Cabinet />} />
          <Route path="/admin"             element={<Navigate to="/cabinet" replace />} />
          <Route path="/groups/kids-6-10"  element={<GroupKids1 />} />
          <Route path="/groups/kids-11-16" element={<GroupKids2 />} />
          <Route path="/groups/adults"     element={<GroupAdults />} />
          <Route path="/champions"         element={<Champions />} />
          <Route path="/privacy"           element={<Privacy />} />
          <Route path="/quiz"              element={<Quiz />} />
          <Route path="/news"              element={<NewsPage />} />
          <Route path="/about/why"         element={<WhyTaipan />} />
          <Route path="/invite/:token"     element={<InvitePage />} />

          {/* Закрытый раздел «Подготовка к аттестации» — только для членов клуба */}
          <Route path="/preparation"                  element={<PrivateRoute><Preparation /></PrivateRoute>} />
          <Route path="/preparation/gallery"          element={<PrivateRoute><Gallery /></PrivateRoute>} />
          <Route path="/preparation/method/:slug"     element={<PrivateRoute><Methodichka /></PrivateRoute>} />
          <Route path="/preparation/plan/:gup"        element={<PrivateRoute><Plan /></PrivateRoute>} />
        </Routes>
      </Suspense>
      <Footer />
      <CookieBanner />
    </>
  )
}
