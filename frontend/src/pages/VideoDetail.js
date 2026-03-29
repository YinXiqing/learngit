import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null
  });
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [hoveredRelatedVideo, setHoveredRelatedVideo] = useState(null);

  useEffect(() => {
    fetchVideoDetail();
  }, [id]);

  // Auto-play video when video data is loaded
  useEffect(() => {
    if (video && !isPlaying) {
      setIsPlaying(true);
    }
  }, [video]);

  const fetchVideoDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/video/detail/${id}`);
      setVideo(response.data.video);
      setIsPlaying(true);
      fetchRelatedVideos(response.data.video);
    } catch (err) {
      console.error('Error fetching video detail:', err);
      setError('视频加载失败，请重试');
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedVideos = async (currentVideo) => {
    setRelatedLoading(true);
    try {
      // 基于当前视频的标签获取相关视频
      const response = await api.get('/video/list', {
        params: {
          per_page: 8,
          search: currentVideo.tags && currentVideo.tags.length > 0 ? currentVideo.tags[0] : ''
        }
      });
      
      // 过滤掉当前视频
      const filteredVideos = response.data.videos.filter(v => v.id !== currentVideo.id);
      setRelatedVideos(filteredVideos.slice(0, 6)); // 最多显示6个相关视频
    } catch (err) {
      console.error('Error fetching related videos:', err);
      setRelatedVideos([]);
    } finally {
      setRelatedLoading(false);
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

  const handleApprove = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'info',
      title: '审核通过',
      message: '确定要通过这个视频的审核吗？通过后视频将对所有用户可见。',
      onConfirm: async () => {
        try {
          await api.put(`/admin/videos/${video.id}`, { status: 'approved' });
          setVideo({ ...video, status: 'approved' });
          alert('视频已通过审核');
        } catch (error) {
          console.error('Error approving video:', error);
          alert('操作失败，请重试');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleReject = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'warning',
      title: '审核拒绝',
      message: '确定要拒绝这个视频的审核吗？拒绝后视频将不会对普通用户显示。',
      onConfirm: async () => {
        try {
          await api.put(`/admin/videos/${video.id}`, { status: 'rejected' });
          setVideo({ ...video, status: 'rejected' });
          alert('视频已拒绝');
        } catch (error) {
          console.error('Error rejecting video:', error);
          alert('操作失败，请重试');
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
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    };
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error || '视频未找到'}</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video Player */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
              {isPlaying ? (
                video.is_scraped ? (
                  // 外部视频使用iframe播放
                  <iframe
                    src={video.source_url}
                    title={video.title}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                  ></iframe>
                ) : (
                  // 本地视频使用video标签
                  <video
                    controls
                    autoPlay
                    className="w-full h-full"
                    onEnded={() => setIsPlaying(false)}
                    src={`${api.defaults.baseURL}/video/stream/${video.id}`}
                  >
                    您的浏览器不支持视频播放。
                  </video>
                )
              ) : (
                <div className="relative w-full h-full">
                  {video.cover_image ? (
                    <img
                      src={video.is_scraped ? video.cover_image : `http://localhost:5000/api/video/cover/${video.id}`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 如果封面加载失败，显示默认占位符
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <svg class="w-20 h-20 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <svg className="w-20 h-20 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Play Button Overlay */}
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                  >
                    <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>
                {video.status === 'pending' && getStatusBadge(video.status)}
              </div>
              
              <div className="flex items-center text-sm text-gray-500 space-x-4 mb-4">
                <span>{formatViews(video.view_count)} 次观看</span>
                <span>•</span>
                <span>{new Date(video.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{formatDuration(video.duration)}</span>
              </div>

              {/* Admin Actions */}
              {isAdmin() && video.status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-blue-800 mb-3">管理员审核操作</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleApprove}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                    >
                      通过审核
                    </button>
                    <button
                      onClick={handleReject}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      拒绝视频
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-primary-700">
                    {video.author?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{video.author || '未知用户'}</p>
                </div>
              </div>

              {video.description && (
                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">视频简介</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{video.description}</p>
                </div>
              )}

              {video.tags && video.tags.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">相关推荐</h3>
              
              {relatedLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex space-x-3">
                        <div className="w-32 h-20 bg-gray-200 rounded"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : relatedVideos.length > 0 ? (
                <div className="space-y-4">
                  {relatedVideos.map((relatedVideo) => (
                    <Link
                      key={relatedVideo.id}
                      to={`/video/${relatedVideo.id}`}
                      className="flex space-x-3 group cursor-pointer"
                    >
                      <div 
                        className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative"
                        onMouseEnter={() => setHoveredRelatedVideo(relatedVideo.id)}
                        onMouseLeave={() => setHoveredRelatedVideo(null)}
                      >
                        {hoveredRelatedVideo === relatedVideo.id ? (
                          <video
                            src={`http://localhost:5000/api/video/stream/${relatedVideo.id}`}
                            autoPlay
                            muted
                            loop
                            className="w-full h-full object-cover"
                          />
                        ) : relatedVideo.cover_image ? (
                          <img
                            src={`http://localhost:5000/api/video/cover/${relatedVideo.id}`}
                            alt={relatedVideo.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                          </div>
                        )}
                        {/* Duration Badge - 只在未悬浮时显示 */}
                        {hoveredRelatedVideo !== relatedVideo.id && (
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                            {formatDuration(relatedVideo.duration)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
                          {relatedVideo.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">{relatedVideo.author}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatViews(relatedVideo.view_count)} 次观看
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无相关推荐视频</p>
              )}
            </div>
          </div>
        </div>
      </div>

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

export default VideoDetail;
