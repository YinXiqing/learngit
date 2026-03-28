import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import VideoDetail from './pages/VideoDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Upload from './pages/Upload';
import MyVideos from './pages/MyVideos';
import SearchResults from './pages/SearchResults';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminVideos from './pages/admin/AdminVideos';
import AdminUsers from './pages/admin/AdminUsers';
import AdminScraper from './pages/admin/AdminScraper';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/video/:id" element={<VideoDetail />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* User Routes */}
            <Route path="/upload" element={<Upload />} />
            <Route path="/my-videos" element={<MyVideos />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/videos" element={<AdminVideos />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/scraper" element={<AdminScraper />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
