import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import PrivateRoute from './components/PrivateRoute'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Calendar from './pages/Calendar'
import Apply from './pages/Apply'
import Login from './pages/Login'
import Register from './pages/Register'
import Cabinet from './pages/Cabinet'
import { Navigate } from 'react-router-dom'
import About from './pages/About'
import GroupKids1 from './pages/GroupKids1'
import GroupKids2 from './pages/GroupKids2'
import GroupAdults from './pages/GroupAdults'
import Champions from './pages/Champions'
import Privacy from './pages/Privacy'
import Quiz from './pages/Quiz'
import NewsPage from './pages/News'
import WhyTaipan from './pages/WhyTaipan'
import InvitePage from './pages/InvitePage'
import CookieBanner from './components/CookieBanner'
import Preparation from './pages/preparation/Preparation'
import Gallery from './pages/preparation/Gallery'
import Methodichka from './pages/preparation/Methodichka'
import Plan from './pages/preparation/Plan'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
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
      <Footer />
<CookieBanner />
    </>
  )
}
