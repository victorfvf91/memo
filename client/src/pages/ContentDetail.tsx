import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contentApi } from '../services/api';
import toast from 'react-hot-toast';

const ContentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState<any>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    contentApi.getById(id)
      .then(res => {
        setContent(res.data.content);
        setClusters(res.data.clusters || []);
      })
      .catch(() => {
        setError('Failed to load content');
        toast.error('Failed to load content');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : content ? (
        <>
          <h1 className="text-2xl font-bold mb-2">{content.title || content.url}</h1>
          <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">{content.url}</a>
          <div className="mt-4 bg-white rounded-lg shadow p-4 border border-gray-100">
            <div className="mb-2 text-gray-700">{content.metadata?.analysis?.summary || 'No summary available.'}</div>
            <div className="text-xs text-gray-500 mb-2">{content.metadata?.author && <>By {content.metadata.author} · </>}{content.domain} · {content.created_at ? new Date(content.created_at).toLocaleDateString() : ''}</div>
            <div className="text-xs text-gray-400">Type: {content.content_type} · Reading time: {content.reading_time_estimate || '?'} min</div>
          </div>
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Clusters</h2>
            {clusters.length === 0 ? (
              <div className="text-gray-500">Not assigned to any cluster.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {clusters.map((cluster: any) => (
                  <Link to={`/clusters/${cluster.id}`} key={cluster.id} className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm hover:bg-blue-200">
                    {cluster.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ContentDetail; 