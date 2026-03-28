import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../contexts/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';

const AdminVideos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [editingVideo, setEditingVideo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null
  });

  useEffect(() => {
    fetchVideos();
  }, [statusFilter, currentPage, searchQuery]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/videos', {
        params: {
          status: statusFilter,
          page: currentPage,
          per_page: 20,
          search: searchQuery
        }
      });
      setVideos(response.data.videos);
      setTotalPages(response.data.pages);
      setSelectedVideos([]);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchVideos();
  };

  const handleStatusChange = (status) => {
    setSearchParams({ status });
    setCurrentPage(1);
  };

  const toggleSelectVideo = (videoId) => {
    setSelectedVideos(prev =>
      prev.includes(videoId)
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedVideos(
      selectedVideos.length === videos.length
        ? []
        : videos.map(v => v.id)
    );
  };

  const bulkUpdateStatus = async (status, videoIds = null, callback = null) => {
    const videosToUpdate = videoIds || selectedVideos;
    if (videosToUpdate.length === 0) return;
    
    try {
      await api.post('/admin/videos/bulk-update', {
        video_ids: videosToUpdate,
        status
      });
      fetchVideos();
      if (callback) callback();
    } catch (error) {
      console.error('Error updating videos:', error);
      alert('操作失败，请重试');
    }
  };

  const bulkDelete = () => {
    if (selectedVideos.length === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: '批量删除视频',
      message: `确定要删除选中的 ${selectedVideos.length} 个视频吗？此操作不可撤销。`,
      onConfirm: async () => {
        try {
          await api.post('/admin/videos/bulk-delete', {
            video_ids: selectedVideos
          });
          fetchVideos();
        } catch (error) {
          console.error('Error deleting videos:', error);
          alert('删除失败，请重试');
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
          await api.delete(`/admin/videos/${videoId}`);
          fetchVideos();
        } catch (error) {
          console.error('Error deleting video:', error);
          alert('删除失败，请重试');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const updateVideo = async (videoId, data) => {
    try {
      await api.put(`/admin/videos/${videoId}`, data);
      setEditingVideo(null);
      fetchVideos();
    } catch (error) {
      console.error('Error updating video:', error);
      alert('更新失败，请重试');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">视频管理</h1>
            <p className="text-gray-600 mt-1">管理平台所有视频内容</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Status Tabs */}
            <div className="flex space-x-1">
              {[
                { id: 'all', label: '全部' },
                { id: 'pending', label: '待审核' },
                { id: 'approved', label: '已通过' },
                { id: 'rejected', label: '已拒绝' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleStatusChange(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex space-x-2">
              <input
                type="text"
                placeholder="搜索视频标题、作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
              >
                搜索
              </button>
              {videos.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg text-sm hover:bg-primary-200 transition-colors"
                >
                  {selectedVideos.length === videos.length ? '取消全选' : '全选'}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedVideos.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-primary-800 font-medium">
                已选择 {selectedVideos.length} 个视频
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => bulkUpdateStatus('approved')}
                  className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors"
                >
                  批量通过
                </button>
                <button
                  onClick={() => bulkUpdateStatus('rejected')}
                  className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  批量拒绝
                </button>
                <button
                  onClick={bulkDelete}
                  className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 transition-colors"
                >
                  批量删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Videos Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-24 h-16 bg-gray-200 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : videos.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedVideos.length === videos.length && videos.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </div>
                  <div className="col-span-5">视频</div>
                  <div className="col-span-2">作者</div>
                  <div className="col-span-2">状态</div>
                  <div className="col-span-2 text-center">操作</div>
                </div>
              </div>

              {/* Video List */}
              <div className="divide-y divide-gray-100">
                {videos.map((video) => (
                  <div key={video.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Checkbox */}
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={selectedVideos.includes(video.id)}
                          onChange={() => toggleSelectVideo(video.id)}
                          className="rounded border-gray-300"
                        />
                      </div>

                      {/* Video Thumbnail and Title */}
                      <div className="col-span-5">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-24 h-16 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                            <Link to={`/video/${video.id}`} target="_blank">
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
                                  <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                  </svg>
                                </div>
                              )}
                            </Link>
                            
                            {/* Duration Badge */}
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                              {formatDuration(video.duration)}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 mb-1 hover:text-primary-600 transition-colors line-clamp-1">
                              <Link to={`/video/${video.id}`} target="_blank">
                                {video.title}
                              </Link>
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {video.description || '暂无简介'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Author */}
                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 truncate">{video.author}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        {getStatusBadge(video.status)}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2">
                        <div className="flex items-center justify-center space-x-1">
                          {video.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    type: 'success',
                                    title: '通过审核',
                                    message: `确定要通过视频"${video.title}"的审核吗？`,
                                    onConfirm: () => {
                                                                      bulkUpdateStatus('approved', [video.id]);
                                                                      setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                                    }
                                  });
                                }}
                                className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                通过
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    type: 'danger',
                                    title: '拒绝视频',
                                    message: `确定要拒绝视频"${video.title}"的审核吗？`,
                                    onConfirm: () => {
                                                                      bulkUpdateStatus('rejected', [video.id]);
                                                                      setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                                    }
                                  });
                                }}
                                className="inline-flex items-center px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                              >
                                拒绝
                              </button>
                            </>
                          )}
                          
                          <Link
                            to={`/video/${video.id}`}
                            target="_blank"
                            className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                          >
                            查看
                          </Link>
                          
                          <button
                            onClick={() => setEditingVideo(video)}
                            className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                            title="编辑"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => deleteVideo(video.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p className="text-gray-500">暂无视频</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-4 py-2">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-4">编辑视频</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input
                  type="text"
                  defaultValue={editingVideo.title}
                  onChange={(e) => editingVideo.title = e.target.value}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                <textarea
                  defaultValue={editingVideo.description}
                  onChange={(e) => editingVideo.description = e.target.value}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  defaultValue={editingVideo.status}
                  onChange={(e) => editingVideo.status = e.target.value}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
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
                onClick={() => updateVideo(editingVideo.id, editingVideo)}
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

export default AdminVideos;
