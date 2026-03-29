import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const NotificationBell = () => {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState({
    pendingCount: 0,
    rejectedCount: 0,
    showDropdown: false
  });

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // 监听路由变化，实时更新通知数量
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, []); // 每次组件渲染时都更新

  const fetchNotifications = async () => {
    try {
      if (isAdmin()) {
        // 管理员：从视频管理页面相同的API获取待审核视频数量
        const response = await api.get('/video/list?status=pending');
        setNotifications(prev => ({
          ...prev,
          pendingCount: response.data.total || 0
        }));
      } else {
        // 普通用户：获取被拒绝的视频数量
        const response = await api.get('/video/my-videos');
        const rejectedVideos = response.data.videos?.filter(v => v.status === 'rejected') || [];
        setNotifications(prev => ({
          ...prev,
          rejectedCount: rejectedVideos.length
        }));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const toggleDropdown = () => {
    setNotifications(prev => ({
      ...prev,
      showDropdown: !prev.showDropdown
    }));
  };

  const hasNotifications = isAdmin() ? notifications.pendingCount > 0 : notifications.rejectedCount > 0;

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* 通知徽章 */}
        {hasNotifications && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
            {isAdmin() ? notifications.pendingCount : notifications.rejectedCount}
          </span>
        )}
      </button>

      {/* 下拉菜单 */}
      {notifications.showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            {isAdmin() ? (
              // 管理员通知
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">待审核视频</h3>
                    <p className="text-sm text-gray-500">有 {notifications.pendingCount} 个视频需要审核</p>
                  </div>
                </div>
                
                {notifications.pendingCount > 0 && (
                  <Link
                    to="/admin/videos"
                    onClick={() => setNotifications(prev => ({ ...prev, showDropdown: false }))}
                    className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    立即审核
                  </Link>
                )}
              </div>
            ) : (
              // 普通用户通知
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.932-3L13.932 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.57 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">审核未通过</h3>
                    <p className="text-sm text-gray-500">有 {notifications.rejectedCount} 个视频未通过审核</p>
                  </div>
                </div>
                
                {notifications.rejectedCount > 0 && (
                  <Link
                    to="/my-videos"
                    onClick={() => setNotifications(prev => ({ ...prev, showDropdown: false }))}
                    className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    查看我的视频
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 点击外部关闭下拉菜单 */}
      {notifications.showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setNotifications(prev => ({ ...prev, showDropdown: false }))}
        />
      )}
    </div>
  );
};

export default NotificationBell;
