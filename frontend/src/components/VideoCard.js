import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const VideoCard = ({ video, hoveredVideo, setHoveredVideo, formatViews, formatDuration }) => {
  const isHovered = hoveredVideo === video.id;

  const handleImageError = (e) => {
    // 如果封面加载失败，尝试使用代理
    if (video.is_scraped && video.cover_image && !e.target.src.includes('/proxy/')) {
      e.target.src = `/api/admin/proxy/image?url=${encodeURIComponent(video.cover_image)}`;
    } else {
      // 显示默认占位符
      e.target.style.display = 'none';
      e.target.parentElement.innerHTML = `
        <div class="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
          <svg class="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
          </svg>
        </div>
      `;
    }
  };

  return (
    <div
      className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
      onMouseEnter={() => setHoveredVideo(video.id)}
      onMouseLeave={() => setHoveredVideo(null)}
    >
      <Link to={`/video/${video.id}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          {isHovered && !video.is_scraped ? (
            <video
              src={`http://localhost:5000/api/video/stream/${video.id}`}
              autoPlay
              muted
              loop
              className="w-full h-full object-cover"
            />
          ) : video.cover_image ? (
            <img
              src={video.is_scraped ? video.cover_image : `http://localhost:5000/api/video/cover/${video.id}`}
              alt={video.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
            </div>
          )}
          {/* Duration Badge - 只在未悬浮时显示 */}
          {!isHovered && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDuration ? formatDuration(video.duration) : '00:00'}
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {video.title}
        </h3>
        <p className="text-sm text-gray-500 mb-2">{video.author}</p>
        <div className="flex items-center text-xs text-gray-400 space-x-3">
          <span>{formatViews ? formatViews(video.view_count) : video.view_count} 次观看</span>
          <span>•</span>
          <span>{new Date(video.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
