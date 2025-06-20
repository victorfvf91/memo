import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow mb-8">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-xl font-bold text-blue-700">SmartBookmarks</Link>
            <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
            <Link to="/save" className="text-gray-700 hover:text-blue-600">Save</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">{user?.name}</span>
            <Link to="/profile" className="text-gray-700 hover:text-blue-600">Profile</Link>
            <button onClick={handleLogout} className="ml-2 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Logout</button>
          </div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 