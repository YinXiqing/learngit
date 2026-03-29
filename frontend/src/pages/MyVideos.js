import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const MyVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [editingVideo, setEditingVideo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null
  });

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  useEffect(() => {
    fetchMyVideos();
  }, []);

  const fetchMyVideos = async () => {
    try {
      const response = await api.get('/video/my-videos');
      setVideos(response.data.videos);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const editVideo = (video) => {
    setEditingVideo({ ...video });
  };

  const updateVideo = async () => {
    setConfirmDialog({
      isOpen: true,
      type: 'info',
      title: '保存视频信息',
      message: '确定要保存对视频信息的修改吗？',
      onConfirm: async () => {
        try {
          await api.put(`/video/my-videos/${editingVideo.id}/edit`, {
            title: editingVideo.title,
            description: editingVideo.description,
            tags: editingVideo.tags
          });
          setEditingVideo(null);
          fetchMyVideos();
        } catch (error) {
          console.error('Error updating video:', error);
          alert('更新失败，请重试');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const deleteVideo = (videoId) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: '删除视频',
      message: '确定要删除这个视频吗？此操作不可撤销。',
      onConfirm: async () => {
        try {
          await api.delete(`/video/my-videos/${videoId}/delete`);
          fetchMyVideos();
        } catch (error) {
          console.error('Error deleting video:', error);
          alert('删除失败，请重试');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: '审核中',
      approved: '已通过',
      rejected: '已拒绝'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredVideos = activeTab === 'all' 
    ? videos 
    : videos.filter(video => video.status === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的视频</h1>
            <p className="text-gray-600 mt-1">管理您上传的视频内容</p>
          </div>
          <Link
            to="/upload"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>上传视频</span>
          </Link>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-t-xl shadow-sm border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'all', label: '全部', count: videos.length },
              { id: 'approved', label: '已通过', count: videos.filter(v => v.status === 'approved').length },
              { id: 'pending', label: '审核中', count: videos.filter(v => v.status === 'pending').length },
              { id: 'rejected', label: '已拒绝', count: videos.filter(v => v.status === 'rejected').length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Videos List */}
        <div className="bg-white rounded-b-xl shadow-sm">
          {loading ? (
            <div className="p-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 py-4 border-b border-gray-100 animate-pulse">
                  <div className="w-40 h-24 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredVideos.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-6">视频</div>
                  <div className="col-span-2">状态</div>
                  <div className="col-span-2">数据</div>
                  <div className="col-span-2 text-center">操作</div>
                </div>
              </div>

              {/* Video List */}
              <div className="divide-y divide-gray-100">
                {filteredVideos.map((video) => (
                  <div key={video.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Video Thumbnail and Title */}
                      <div className="col-span-6">
                        <div className="flex items-center space-x-4">
                          <div className="relative w-32 h-20 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                            <Link to={`/video/${video.id}`}>
                              {video.cover_image ? (
                                <img
                                  src={video.is_scraped ? video.cover_image : `http://localhost:5000/api/video/cover/${video.id}`}
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // 如果封面加载失败，尝试使用代理
                                    if (video.is_scraped && !e.target.src.includes('/proxy/')) {
                                      e.target.src = `/api/admin/proxy/image?url=${encodeURIComponent(video.cover_image)}`;
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                </div>
                              )}
                            </Link>
                            
                            {/* Duration Badge */}
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                              {formatDuration(video.duration)}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1 hover:text-primary-600 transition-colors line-clamp-2">
                              <Link to={`/video/${video.id}`}>
                                {video.title}
                              </Link>
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {video.description || '暂无简介'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        {getStatusBadge(video.status)}
                      </div>

                      {/* Data */}
                      <div className="col-span-2">
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>{formatViews(video.view_count)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{new Date(video.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2">
                        <div className="flex items-center justify-center space-x-2">
                          <Link
                            to={`/video/${video.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            查看
                          </Link>
                          <button
                            onClick={() => editVideo(video)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                            title="编辑"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteVideo(video.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {activeTab === 'all' ? '暂无视频' : `暂无${activeTab === 'pending' ? '审核中' : activeTab === 'approved' ? '已通过' : '已拒绝'}的视频`}
              </h3>
              <p className="text-gray-500 mb-4">
                {activeTab === 'all' ? '开始上传您的第一个视频吧！' : '切换其他标签查看更多视频'}
              </p>
              {activeTab === 'all' && (
                <Link
                  to="/upload"
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  上传视频
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingVideo && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑视频信息</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
              <input
                type="text"
                value={editingVideo.title}
                onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
              <textarea
                value={editingVideo.description || ''}
                onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
              <input
                type="text"
                value={editingVideo.tags ? editingVideo.tags.join(', ') : ''}
                onChange={(e) => setEditingVideo({ ...editingVideo, tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) })}
                placeholder="用逗号分隔多个标签"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setEditingVideo(null)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={updateVideo}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Confirm Dialog */}
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      onConfirm={confirmDialog.onConfirm}
      title={confirmDialog.title}
      message={confirmDialog.message}
      type={confirmDialog.type}
      confirmText="确认"
      cancelText="取消"
    />
    </div>
  );
};

export default MyVideos;
