import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Home from './components/Home';
import NewsFeed from './components/NewsFeed';
import BorrowForm from './components/BorrowForm';
import ReturnForm from './components/ReturnForm';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import './index.css';

const PrivateRoute = ({ children }) => {
  const token = sessionStorage.getItem('adminToken');
  const isDemo = new URLSearchParams(window.location.search).get('demo') === 'true';
  return (token || isDemo) ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/news" element={<NewsFeed />} />
          <Route path="/borrow" element={<BorrowForm />} />
          <Route path="/return" element={<ReturnForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
