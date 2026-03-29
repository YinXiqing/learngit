import React, { useState, useEffect } from 'react';
import { api } from '../../contexts/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';

const AdminScraper = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapedVideos, setScrapedVideos] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSite, setSelectedSite] = useState('91p');
  const [previewVideo, setPreviewVideo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null
  });
  const [hlsInstance, setHlsInstance] = useState(null);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 检测m3u8是否有效
  const checkM3U8Valid = async (url) => {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors'  // 避免CORS问题
      });
      return true;
    } catch (error) {
      console.log('M3U8 check failed:', error);
      return false;
    }
  };

  // 重新抓取m3u8地址
  const refreshM3U8IfNeeded = async () => {
    if (!previewVideo || !previewVideo.source_url || isRefreshing) return;
    
    setIsRefreshing(true);
    console.log('Refreshing M3U8 for video:', previewVideo.id);
    
    try {
      const response = await fetch('/admin/scrape/refresh-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: previewVideo.id,
          source_url: previewVideo.source_url
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.new_url) {
          console.log('Got new M3U8 URL:', data.new_url);
          
          // 更新预览视频的URL
          setPreviewVideo(prev => ({
            ...prev,
            video_url: data.new_url
          }));
          
          // 更新列表中的视频URL
          setScrapedVideos(prev => prev.map(video => 
            video.id === previewVideo.id 
              ? { ...video, video_url: data.new_url }
              : video
          ));
          
          setSuccess('M3U8地址已更新');
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (error) {
      console.error('Failed to refresh M3U8:', error);
      setError('刷新M3U8地址失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 处理Video.js + HLS.js视频播放和iframe预览
  useEffect(() => {
    if (previewVideo && previewVideo.video_url) {
      // 检测是否是iframe格式
      const isIframe = previewVideo.video_url.includes('<iframe') || 
                      previewVideo.video_url.includes('player.bilibili.com');
      
      if (!isIframe && previewVideo.video_url.includes('.m3u8')) {
        const videoUrl = previewVideo.video_url;
        
        // 初始化Video.js + HLS.js
        const initVideoPlayer = () => {
          const videoElement = document.querySelector('#preview-video');
          if (videoElement && window.videojs) {
            try {
              console.log('Initializing Video.js + HLS.js with URL:', videoUrl);
              
              // 销毁之前的实例
              if (window.player) {
                window.player.dispose();
              }
              
              // 创建Video.js播放器
              window.player = window.videojs(videoElement, {
                controls: true,
                autoplay: true,
                muted: true,
                preload: 'metadata',
                fluid: true,
                responsive: true,
                html5: {
                  hlsjsConfig: {
                    debug: true,
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90,
                    maxBufferLength: 600,
                    maxMaxBufferLength: 1200,
                  }
                }
              });
              
              // 设置视频源
              window.player.src({
                src: videoUrl,
                type: 'application/x-mpegURL'
              });
              
              // 监听播放器事件
              window.player.on('loadedmetadata', () => {
                console.log('Video metadata loaded');
              });
              
              window.player.on('canplay', () => {
                console.log('Video can play');
              });
              
              window.player.on('error', (error) => {
                console.error('Video player error:', error);
                // 如果播放失败，尝试重新抓取m3u8
                refreshM3U8IfNeeded();
              });
              
              // 如果使用HLS.js，监听HLS事件
              if (window.player.tech_ && window.player.tech_.hls) {
                const hls = window.player.tech_.hls;
                
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                  console.log('HLS manifest parsed successfully');
                });
                
                hls.on(window.Hls.Events.FRAG_LOADED, () => {
                  console.log('HLS fragment loaded');
                });
                
                hls.on(window.Hls.Events.ERROR, (event, data) => {
                  console.error('HLS error:', data);
                  if (data.fatal) {
                    console.error('Fatal HLS error, attempting refresh');
                    refreshM3U8IfNeeded();
                  }
                });
              }
              
            } catch (error) {
              console.error('Error initializing video player:', error);
            }
          }
        };
        
        // 动态加载Video.js和HLS.js
        const loadLibraries = () => {
          let videoJsLoaded = !!window.videojs;
          let hlsJsLoaded = !!window.Hls;
          
          const checkAndInit = () => {
            if (videoJsLoaded && hlsJsLoaded) {
              initVideoPlayer();
            }
          };
          
          // 加载Video.js CSS
          if (!videoJsLoaded) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://vjs.zencdn.net/8.6.1/video-js.css';
            document.head.appendChild(cssLink);
            
            // 加载Video.js
            const script = document.createElement('script');
            script.src = 'https://vjs.zencdn.net/8.6.1/video.min.js';
            script.onload = () => {
              console.log('Video.js loaded');
              videoJsLoaded = true;
              checkAndInit();
            };
            script.onerror = () => {
              console.error('Failed to load Video.js');
            };
            document.head.appendChild(script);
          }
          
          // 加载HLS.js
          if (!hlsJsLoaded) {
            const hlsScript = document.createElement('script');
            hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            hlsScript.onload = () => {
              console.log('HLS.js loaded');
              hlsJsLoaded = true;
              checkAndInit();
            };
            hlsScript.onerror = () => {
              console.error('Failed to load HLS.js');
            };
            document.head.appendChild(hlsScript);
          }
          
          // 如果都已加载，直接初始化
          if (videoJsLoaded && hlsJsLoaded) {
            initVideoPlayer();
          }
        };
        
        // 延迟加载，确保DOM已准备好
        const timer = setTimeout(loadLibraries, 500);
        return () => {
          clearTimeout(timer);
          // 清理播放器实例
          if (window.player) {
            window.player.dispose();
            window.player = null;
          }
        };
      }
    }
  }, [previewVideo]);

  // 网站配置
  const sites = [
    {
      id: '91p',
      name: '其他视频',
      logo: (isSelected) => (
        <div className="flex flex-col items-center justify-center">
          <span className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-red-600'}`}>其他</span>
          <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-blue-500'}`}>视频</span>
        </div>
      ),
      color: 'bg-red-500'
    },
    {
      id: 'bilibili',
      name: 'Bilibili',
      logo: (isSelected) => (
        <svg className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-blue-500'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.789 1.894v7.52c.02.765.283 1.395.789 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.128.789-1.893v-7.52c-.02-.765-.283-1.396-.789-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96v-1.173c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96v-1.173c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
        </svg>
      ),
      color: 'bg-blue-500'
    }
  ];

  useEffect(() => {
    fetchScrapedVideos();
  }, []);

  // 自动清除提示信息
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000); // 5秒后自动清除
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const fetchScrapedVideos = async () => {
    try {
      const response = await api.get('/admin/scraped');
      const videos = response.data.scraped_videos;
      console.log('Fetched scraped videos:', videos);
      console.log('First video cover_url:', videos[0]?.cover_url);
      setScrapedVideos(videos);
    } catch (error) {
      console.error('Error fetching scraped videos:', error);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/admin/scrape', { 
        url, 
        site: selectedSite 
      });
      setSuccess('视频信息抓取成功！请在下方查看抓取结果。');
      setUrl('');
      fetchScrapedVideos();
    } catch (error) {
      console.error('Error scraping video:', error);
      setError(error.response?.data?.error || '抓取失败，请检查URL是否正确或网络连接');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (scrapedId, closePreviewAfter = false) => {
    try {
      console.log('Publishing video ID:', scrapedId);
      const response = await api.post(`/admin/scraped/${scrapedId}/import`, {});
      console.log('Publish response:', response.data);
      setSuccess('抓取的视频已成功发布到平台！');
      fetchScrapedVideos();
      
      // 如果指定了关闭预览，则关闭预览界面
      if (closePreviewAfter) {
        closePreview();
      }
    } catch (error) {
      console.error('Error publishing video:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      setError(error.response?.data?.error || '发布失败，请检查网络连接后重试');
    }
  };

  const handleReject = async (scrapedId) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: '删除抓取记录',
      message: '确定要删除这个抓取记录吗？此操作不可撤销，删除后将无法恢复抓取的视频信息。',
      onConfirm: async () => {
        try {
          // Delete the scraped video
          await api.delete(`/admin/scraped/${scrapedId}`);
          setSuccess('抓取记录已成功删除！');
          fetchScrapedVideos();
        } catch (error) {
          console.error('Error deleting video:', error);
          setError('删除失败，请重试');
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onClose: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSiteChange = (siteId) => {
    setSelectedSite(siteId);
    setError('');
    setSuccess('');
  };

  const handlePreview = async (video) => {
    setPreviewVideo(video);
    
    // 如果是m3u8视频，先检测有效性
    if (video.video_url && video.video_url.includes('.m3u8')) {
      const isValid = await checkM3U8Valid(video.video_url);
      if (!isValid) {
        console.log('M3U8 is invalid, refreshing...');
        // 延迟一点时间让预览界面先显示
        setTimeout(() => {
          refreshM3U8IfNeeded();
        }, 1000);
      }
    }
  };

  const closePreview = () => {
    // 清理HLS实例
    if (hlsInstance) {
      hlsInstance.destroy();
      setHlsInstance(null);
    }
    setPreviewVideo(null);
  };

  // 批量选择处理
  const handleSelectVideo = (videoId) => {
    setSelectedVideos(prev => {
      if (prev.includes(videoId)) {
        return prev.filter(id => id !== videoId);
      } else {
        return [...prev, videoId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedVideos([]);
      setSelectAll(false);
    } else {
      const pendingVideos = scrapedVideos.filter(video => video.status === 'pending').map(video => video.id);
      setSelectedVideos(pendingVideos);
      setSelectAll(true);
    }
  };

  const handleBatchPublish = () => {
    if (selectedVideos.length === 0) {
      setError('请先选择要发布的视频');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      type: 'warning',
      title: '批量发布视频',
      message: `确定要发布选中的 ${selectedVideos.length} 个视频吗？`,
      onConfirm: async () => {
        try {
          const response = await api.post('/admin/scraped/batch-publish', {
            video_ids: selectedVideos
          });
          
          setSuccess(response.data.message || `成功发布 ${response.data.success_count} 个视频！`);
          setSelectedVideos([]);
          setSelectAll(false);
          fetchScrapedVideos();
        } catch (error) {
          console.error('Error batch publishing:', error);
          setError('批量发布失败：' + (error.response?.data?.error || error.message));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedVideos.length === 0) {
      setError('请先选择要删除的视频');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: '批量删除视频',
      message: `确定要删除选中的 ${selectedVideos.length} 个抓取记录吗？此操作不可撤销！`,
      onConfirm: async () => {
        try {
          const response = await api.post('/admin/scraped/batch-delete', {
            video_ids: selectedVideos
          });
          
          setSuccess(response.data.message || `成功删除 ${response.data.success_count} 个抓取记录！`);
          setSelectedVideos([]);
          setSelectAll(false);
          fetchScrapedVideos();
        } catch (error) {
          console.error('Error batch deleting:', error);
          setError('批量删除失败：' + (error.response?.data?.error || error.message));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      deleted: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: '待处理',
      published: '已发布',
      deleted: '已删除'
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">视频抓取</h1>
          <p className="text-gray-600 mt-1">从外部网站抓取视频信息并导入平台</p>
        </div>

        <div className="flex gap-6">
          {/* 纵向网站菜单 */}
          <div className="w-20 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-2">
              <h3 className="text-xs font-medium text-gray-500 mb-3 text-center">选择网站</h3>
              <div className="space-y-2">
                {sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => handleSiteChange(site.id)}
                    className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                      selectedSite === site.id
                        ? `${site.color} shadow-lg scale-110`
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    title={site.name}
                  >
                    {typeof site.logo === 'function' ? site.logo(selectedSite === site.id) : site.logo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="flex-1">
            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                {success}
              </div>
            )}

        {/* Scrape Form */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                抓取视频 - {sites.find(s => s.id === selectedSite)?.name}
              </h2>
              <form onSubmit={handleScrape} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    视频页面URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="输入视频页面URL..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  抓取中...
                </span>
              ) : (
                '开始抓取'
              )}
            </button>
          </form>
        </div>

        {/* Scraped Videos List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">抓取记录</h2>
              <div className="flex items-center space-x-2">
                {scrapedVideos.length > 0 && (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {selectAll ? '取消全选' : '全选待处理'}
                    </button>
                    {selectedVideos.length > 0 && (
                      <>
                        <button
                          onClick={handleBatchPublish}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          批量发布 ({selectedVideos.length})
                        </button>
                        <button
                          onClick={handleBatchDelete}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        >
                          批量删除 ({selectedVideos.length})
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {scrapedVideos.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {scrapedVideos.map((video) => (
                <div key={video.id} className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    {video.status === 'pending' && (
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={selectedVideos.includes(video.id)}
                          onChange={() => handleSelectVideo(video.id)}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                      </div>
                    )}

                    {/* Cover */}
                    <div className="w-32 h-20 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group" onClick={() => handlePreview(video)}>
                      {video.cover_url ? (
                        <div className="relative w-full h-full">
                          <img
                            src={video.cover_url}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Cover image failed to load:', video.cover_url);
                              e.target.onerror = null;
                              
                              // 尝试通过代理加载
                              if (video.cover_url && !video.cover_url.includes('/proxy/')) {
                                const proxyUrl = `/api/admin/proxy/image?url=${encodeURIComponent(video.cover_url)}`;
                                console.log('Trying proxy URL:', proxyUrl);
                                e.target.src = proxyUrl;
                                return;
                              }
                              
                              // 如果代理也失败，显示错误状态
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full bg-red-100 flex items-center justify-center">
                                    <div class="text-center">
                                      <svg class="w-8 h-8 text-red-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                      <p class="text-xs text-red-600">封面加载失败</p>
                                      <p class="text-xs text-gray-500 mt-1">CORS限制</p>
                                    </div>
                                  </div>
                                `;
                              }
                            }}
                            onLoad={() => {
                              console.log('Cover image loaded successfully:', video.cover_url);
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <svg className="w-8 h-8 text-white/0 group-hover:text-white/80 transition-all" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <>
                          {console.log(`Video ID ${video.id} has no cover_url:`, video.cover_url)}
                          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center group-hover:from-primary-500 group-hover:to-primary-700 transition-colors">
                            <div className="text-center text-white">
                              <svg className="w-8 h-8 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                              </svg>
                              <p className="text-xs">无封面</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 truncate">
                            {video.title || '未命名视频'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {video.description || '暂无描述'}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                            <span className="truncate max-w-xs">{video.source_url}</span>
                            <span>•</span>
                            <span>{new Date(video.scraped_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {getStatusBadge(video.status)}
                        </div>
                      </div>

                      {/* Actions */}
                      {video.status === 'pending' && (
                        <div className="flex space-x-2 mt-4">
                          <button
                            onClick={() => handleImport(video.id)}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            发布视频
                          </button>
                          <button
                            onClick={() => handleReject(video.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                          >
                            删除记录
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无抓取记录</h3>
              <p className="text-gray-500">输入视频页面URL开始抓取</p>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={confirmDialog.onClose || (() => setConfirmDialog(prev => ({ ...prev, isOpen: false })))}
      />

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl max-h-[95vh] w-full overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="sticky top-0 p-5 border-b border-gray-200 bg-white flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">视频预览详情</h3>
              <button
                onClick={closePreview}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 p-6 space-y-6">
              {/* 视频预览区域 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">📺 视频预览</h4>
                <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-300" style={{ aspectRatio: '16/9', minHeight: '350px' }}>
                  {previewVideo.video_url ? (
                    <>
                      {/* 检测是否是iframe格式 */}
                      {previewVideo.video_url.includes('player.bilibili.com') || previewVideo.video_url.includes('<iframe') ? (
                        // 直接渲染iframe或从iframe标签中提取src
                        (() => {
                          let iframeSrc = '';
                          
                          if (previewVideo.video_url.includes('player.bilibili.com')) {
                            // 直接是bilibili播放器URL
                            iframeSrc = previewVideo.video_url;
                          } else if (previewVideo.video_url.includes('<iframe')) {
                            // 从iframe标签中提取src
                            const srcMatch = previewVideo.video_url.match(/src=['"](.*?)['"]/)
                            iframeSrc = srcMatch ? srcMatch[1] : '';
                          }
                          
                          return iframeSrc ? (
                            <iframe
                              key={previewVideo.id}
                              src={iframeSrc}
                              title={previewVideo.title}
                              className="w-full h-full"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                            ></iframe>
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center flex-col gap-2">
                              <svg className="w-12 h-12 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 115.838 3.172a6.002 6.002 0 018.639 11.718zM9 11a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                              <span className="text-gray-400 text-sm">无效的iframe代码</span>
                            </div>
                          )
                        })()
                      ) : (
                        // video标签形式（mp4或m3u8）
                        <video
                          id="preview-video"
                          key={previewVideo.id}
                          className="video-js vjs-default-skin vjs-big-play-centered"
                          controls
                          autoPlay
                          muted
                          preload="metadata"
                          data-setup='{"fluid": true}'
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => {
                            console.error('Video error:', e);
                          }}
                        >
                          {previewVideo.video_url.includes('.m3u8') ? (
                            <source src={previewVideo.video_url} type="application/x-mpegURL" />
                          ) : (
                            <source src={previewVideo.video_url} type="video/mp4" />
                          )}
                          您的浏览器不支持视频播放
                        </video>
                      )}
                    </>
                  ) : previewVideo.cover_url ? (
                    <img
                      src={previewVideo.cover_url}
                      alt={previewVideo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <svg className="w-16 h-16 text-white/30" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* 分隔线 */}
              <hr className="border-gray-200" />

              {/* 视频信息区域 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4">📋 视频信息详情</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* 标题 - 全宽 */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-2 block">📌 标题</label>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
                      <p className="text-sm text-gray-900 break-words leading-relaxed">
                        {previewVideo.title || '无标题'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 描述 - 全宽 */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-2 block">📝 描述</label>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 max-h-24 overflow-y-auto">
                      <p className="text-sm text-gray-800 break-words whitespace-pre-wrap leading-relaxed">
                        {previewVideo.description || '无描述'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 来源URL - 全宽 */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-2 block">🔗 来源URL</label>
                    <a 
                      href={previewVideo.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 rounded-lg border border-blue-200 px-4 py-3 block break-all inline-block max-w-full"
                    >
                      {previewVideo.source_url}
                    </a>
                  </div>
                  
                  {/* 视频真实URL - 全宽 */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-2 block">🎬 视频真实URL</label>
                    <div className="bg-gray-900 rounded-lg border border-gray-700 px-4 py-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all tracking-tight leading-relaxed">
                        {previewVideo.video_url || '未提取到视频URL'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="sticky bottom-0 p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={closePreview}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
              <button
                onClick={() => handleImport(previewVideo.id, true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                发布视频
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScraper;
