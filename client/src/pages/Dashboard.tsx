import React, { useEffect, useState } from 'react';
import { userApi, clusterApi } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [mode, setMode] = useState<'save' | 'consume'>('consume');
  const [clusters, setClusters] = useState<any[]>([]);
  const [recentContent, setRecentContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      userApi.getDashboard(),
      clusterApi.getAll()
    ])
      .then(([dashboardRes, clustersRes]) => {
        setClusters(clustersRes.data.clusters || dashboardRes.data.recentClusters || []);
        setRecentContent(dashboardRes.data.recentContent || []);
      })
      .catch((err) => {
        setError('Failed to load dashboard');
        toast.error('Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-l-md border ${mode === 'save' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            onClick={() => setMode('save')}
          >
            Save Mode
          </button>
          <button
            className={`px-4 py-2 rounded-r-md border ${mode === 'consume' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            onClick={() => setMode('consume')}
          >
            Consume Mode
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">Your Clusters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-10">
            {clusters.length === 0 ? (
              <div className="col-span-full text-gray-500">No clusters yet.</div>
            ) : clusters.map((cluster) => (
              <Link to={`/clusters/${cluster.id}`} key={cluster.id} className="block bg-white rounded-lg shadow hover:shadow-lg transition p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold truncate">{cluster.name}</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{cluster.item_count} items</span>
                </div>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">{cluster.description || 'No description'}</p>
                <div className="text-xs text-gray-400">Last updated: {cluster.last_updated ? new Date(cluster.last_updated).toLocaleDateString() : 'N/A'}</div>
              </Link>
            ))}
          </div>
          <h2 className="text-xl font-semibold mb-4">Recent Content</h2>
          <div className="bg-white rounded-lg shadow p-5 border border-gray-100">
            {recentContent.length === 0 ? (
              <div className="text-gray-500">No recent content.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentContent.map((item) => (
                  <li key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <Link to={`/content/${item.id}`} className="font-medium text-blue-700 hover:underline">
                        {item.title || item.url}
                      </Link>
                      <span className="ml-2 text-xs text-gray-400">{item.domain}</span>
                    </div>
                    <span className="text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 