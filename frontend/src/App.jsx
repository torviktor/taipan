import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Calendar from './pages/Calendar'
import Apply from './pages/Apply'
import Login from './pages/Login'
import Cabinet from './pages/Cabinet'
import Admin from './pages/Admin'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/schedule"  element={<Schedule />} />
        <Route path="/calendar"  element={<Calendar />} />
        <Route path="/apply"     element={<Apply />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/cabinet"   element={<Cabinet />} />
        <Route path="/admin"     element={<Admin />} />
      </Routes>
      <Footer />
    </>
  )
}