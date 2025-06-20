import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clusterApi } from '../services/api';
import toast from 'react-hot-toast';

const VIEW_MODES = [
  { key: 'mixed', label: 'Mixed View' },
  { key: 'summary', label: 'Summary View' },
  { key: 'sources', label: 'Sources View' },
];

const ClusterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [viewMode, setViewMode] = useState('mixed');
  const [cluster, setCluster] = useState<any>(null);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    clusterApi.getById(id, viewMode)
      .then(res => {
        setCluster(res.data.cluster);
        setContent(res.data.content || []);
      })
      .catch(() => {
        setError('Failed to load cluster');
        toast.error('Failed to load cluster');
      })
      .finally(() => setLoading(false));
  }, [id, viewMode]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : cluster ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{cluster.name}</h1>
            <div className="flex gap-2">
              {VIEW_MODES.map(vm => (
                <button
                  key={vm.key}
                  className={`px-3 py-1 rounded ${viewMode === vm.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setViewMode(vm.key)}
                >
                  {vm.label}
                </button>
              ))}
            </div>
          </div>
          {['mixed', 'summary'].includes(viewMode) && (
            <div className="mb-8 bg-white rounded-lg shadow p-6 border border-gray-100">
              <h2 className="text-lg font-semibold mb-2">Synthesized Summary</h2>
              <div className="prose max-w-none mb-2">{cluster.synthesized_summary || 'No summary yet.'}</div>
              {cluster.summary_citations && cluster.summary_citations.length > 0 && (
                <ul className="text-xs text-gray-500 mt-2">
                  {cluster.summary_citations.map((c: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{c.claim}</span> [→ {c.sourceTitle}, saved {c.daysAgo} days ago]
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {['mixed', 'sources'].includes(viewMode) && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-2">Sources</h2>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-100">
                {content.length === 0 ? (
                  <div className="text-gray-500">No sources in this cluster.</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {content.map((item) => (
                      <li key={item.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">
                              {item.title || item.url}
                            </a>
                            <span className="ml-2 text-xs text-gray-400">{item.domain}</span>
                          </div>
                          <span className="text-xs text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{item.metadata?.analysis?.summary}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {cluster.conflicts && cluster.conflicts.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-2 text-red-600">Conflicting Viewpoints</h2>
              <ul className="bg-red-50 rounded-lg p-4 border border-red-200">
                {cluster.conflicts.map((conflict: any, idx: number) => (
                  <li key={idx} className="mb-2">
                    <div className="font-medium">{conflict.description}</div>
                    <div className="text-xs text-gray-500">Sources: {conflict.sources?.join(', ')}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default ClusterDetail; 