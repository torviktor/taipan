import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
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
// import TaipanGPT from './components/TaipanGPT'

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
      </Routes>
      <Footer />
      {/* <TaipanGPT /> */}
    </>
  )
}
