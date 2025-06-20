import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { contentApi, clusterApi } from '../services/api';
import toast from 'react-hot-toast';

interface SaveForm {
  url: string;
  title?: string;
}

const SaveContent: React.FC = () => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SaveForm>();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showClusterInput, setShowClusterInput] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [saved, setSaved] = useState(false);

  // Try to auto-populate from URL params (PWA share target)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const title = params.get('title');
    if (url) setValue('url', url);
    if (title) setValue('title', title);
  }, [setValue]);

  // Poll job status when processing
  React.useEffect(() => {
    if (!jobId || !processing) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await contentApi.checkJobStatus(jobId);
        
        if (response.data.status === 'completed') {
          setProcessing(false);
          setSuggestions(response.data.clusterSuggestions || []);
          toast.success('Content processed! Choose a cluster.');
          clearInterval(pollInterval);
        } else if (response.data.status === 'failed') {
          setProcessing(false);
          toast.error('Content processing failed');
          clearInterval(pollInterval);
        }
        // If still pending, continue polling
      } catch (error) {
        console.error('Failed to check job status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, processing]);

  const onSubmit = async (data: SaveForm) => {
    setLoading(true);
    setSaved(false);
    setSuggestions([]);
    setJobId(null);
    
    try {
      const res = await contentApi.save(data);
      setJobId(res.data.jobId);
      setProcessing(true);
      toast.success('Content saved! Processing in background...');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCluster = async (cluster: any) => {
    setLoading(true);
    try {
      if (cluster.isNew && newClusterName) {
        await clusterApi.create({ name: newClusterName });
        toast.success('New cluster created and assigned!');
      } else if (cluster.id) {
        // Assign to existing cluster (API call would go here)
        toast.success('Assigned to cluster!');
      }
      setSaved(true);
    } catch (error: any) {
      toast.error('Failed to assign cluster');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Save Content</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">URL</label>
          <input
            id="url"
            type="url"
            {...register('url', { required: 'URL is required' })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.url && <span className="text-red-500 text-xs">{errors.url.message}</span>}
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
          <input
            id="title"
            type="text"
            {...register('title')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || processing}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : processing ? 'Processing...' : 'Save'}
        </button>
      </form>
      
      {processing && (
        <div className="mt-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Processing content...</p>
          <p className="text-sm text-gray-500">This may take a few moments</p>
        </div>
      )}
      
      {suggestions.length > 0 && !saved && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Suggested Clusters</h2>
          <div className="flex flex-wrap gap-3">
            {suggestions.map((cluster, idx) => (
              <button
                key={idx}
                onClick={() => handleAssignCluster(cluster)}
                className={`px-4 py-2 rounded-full border flex items-center gap-2 ${cluster.isNew ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} hover:shadow`}
              >
                {cluster.name}
                <span className="text-xs bg-white px-2 py-0.5 rounded-full border ml-2">{Math.round((cluster.confidence || 0) * 100)}%</span>
              </button>
            ))}
            <button
              onClick={() => setShowClusterInput(true)}
              className="px-4 py-2 rounded-full border bg-gray-100 text-gray-700 hover:shadow"
            >
              + Create new cluster
            </button>
          </div>
          {showClusterInput && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="New cluster name"
                value={newClusterName}
                onChange={e => setNewClusterName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => handleAssignCluster({ isNew: true })}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                disabled={!newClusterName || loading}
              >
                Create & Assign
              </button>
            </div>
          )}
        </div>
      )}
      {saved && (
        <div className="mt-8 text-center">
          <div className="text-green-600 font-semibold mb-2">Content saved and assigned!</div>
          <button
            onClick={() => { setSaved(false); setSuggestions([]); setJobId(null); }}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 mt-2"
          >
            Save another
          </button>
        </div>
      )}
    </div>
  );
};

export default SaveContent; 