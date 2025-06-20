import React, { useEffect, useState } from 'react';
import { userApi } from '../services/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<{ name: string; email: string }>();

  useEffect(() => {
    userApi.getProfile()
      .then(res => {
        setProfile(res.data.user);
        setValue('name', res.data.user.name);
        setValue('email', res.data.user.email);
      })
      .catch(() => {
        setError('Failed to load profile');
        toast.error('Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [setValue]);

  const onSubmit = async (data: { name: string; email: string }) => {
    try {
      await userApi.updateProfile(data);
      setProfile((prev: any) => ({ ...prev, ...data }));
      setEditing(false);
      toast.success('Profile updated!');
    } catch (error: any) {
      toast.error('Failed to update profile');
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : profile ? (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                {...register('name', { required: 'Name is required' })}
                disabled={!editing}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              {errors.name && <span className="text-red-500 text-xs">{errors.name.message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                disabled={!editing}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              {errors.email && <span className="text-red-500 text-xs">{errors.email.message}</span>}
            </div>
            <div className="flex gap-2 mt-4">
              {editing ? (
                <>
                  <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Edit</button>
              )}
            </div>
          </form>
          <div className="mt-6">
            <div className="text-sm text-gray-500">Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Profile; 