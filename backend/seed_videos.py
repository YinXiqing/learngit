#!/usr/bin/env python3
"""
添加测试视频数据的脚本
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import User, Video
from datetime import datetime
import random

def create_test_videos():
    """创建测试视频数据"""
    app = create_app()
    
    with app.app_context():
        print("开始添加测试视频数据...")
        
        # 获取第一个用户作为视频作者
        user = User.query.first()
        if not user:
            print("错误：数据库中没有用户，请先创建用户")
            return
        
        # 测试视频数据
        test_videos = [
            {
                'title': 'React 18 完整教程 - 从入门到精通',
                'description': '这是一个全面的React 18教程，涵盖了所有核心概念和最新特性。包括Hooks、Context、Redux等内容。',
                'tags': 'React,JavaScript,前端开发,教程',
                'filename': 'react18_tutorial.mp4',
                'cover_image': None,
                'duration': 3600,  # 1小时
                'status': 'approved'
            },
            {
                'title': 'Python Django 项目实战 - 电商网站开发',
                'description': '从零开始构建一个完整的电商网站，包括用户认证、商品管理、购物车、支付等功能。',
                'tags': 'Python,Django,Web开发,后端',
                'filename': 'django_ecommerce.mp4',
                'cover_image': None,
                'duration': 5400,  # 1.5小时
                'status': 'approved'
            },
            {
                'title': '机器学习入门 - 线性回归详解',
                'description': '深入理解线性回归算法，包括数学原理、代码实现和实际应用案例。',
                'tags': '机器学习,Python,数据科学,算法',
                'filename': 'ml_linear_regression.mp4',
                'cover_image': None,
                'duration': 2400,  # 40分钟
                'status': 'approved'
            },
            {
                'title': 'Vue 3 + TypeScript 实战项目',
                'description': '使用Vue 3和TypeScript开发现代化Web应用，包含组件化开发、状态管理、路由等。',
                'tags': 'Vue,TypeScript,前端,JavaScript',
                'filename': 'vue3_typescript.mp4',
                'cover_image': None,
                'duration': 4800,  # 1小时20分钟
                'status': 'approved'
            },
            {
                'title': '数据结构与算法 - 二叉树完全指南',
                'description': '详细讲解二叉树的数据结构、遍历算法、平衡树等高级概念。',
                'tags': '算法,数据结构,计算机科学,编程',
                'filename': 'binary_trees.mp4',
                'cover_image': None,
                'duration': 3600,  # 1小时
                'status': 'approved'
            },
            {
                'title': 'Docker 容器化部署实战',
                'description': '学习如何使用Docker容器化应用程序，包括镜像构建、容器管理、编排等。',
                'tags': 'Docker,DevOps,容器化,部署',
                'filename': 'docker_deployment.mp4',
                'cover_image': None,
                'duration': 3000,  # 50分钟
                'status': 'approved'
            },
            {
                'title': 'JavaScript 异步编程完全指南',
                'description': '深入理解JavaScript中的异步编程，包括回调函数、Promise、async/await等。',
                'tags': 'JavaScript,异步编程,前端开发',
                'filename': 'js_async_programming.mp4',
                'cover_image': None,
                'duration': 2700,  # 45分钟
                'status': 'approved'
            },
            {
                'title': 'MySQL 数据库优化技巧',
                'description': '学习MySQL数据库的性能优化技巧，包括索引优化、查询优化、配置调优等。',
                'tags': 'MySQL,数据库,优化,后端开发',
                'filename': 'mysql_optimization.mp4',
                'cover_image': None,
                'duration': 3300,  # 55分钟
                'status': 'approved'
            },
            {
                'title': 'React Native 移动应用开发',
                'description': '使用React Native开发跨平台移动应用，一套代码同时支持iOS和Android。',
                'tags': 'React Native,移动开发,跨平台,JavaScript',
                'filename': 'react_native_mobile.mp4',
                'cover_image': None,
                'duration': 4200,  # 1小时10分钟
                'status': 'approved'
            },
            {
                'title': 'Git 版本控制高级用法',
                'description': '掌握Git的高级功能和最佳实践，包括分支策略、合并冲突解决、工作流程等。',
                'tags': 'Git,版本控制,开发工具,协作',
                'filename': 'git_advanced.mp4',
                'cover_image': None,
                'duration': 2400,  # 40分钟
                'status': 'approved'
            },
            {
                'title': 'Node.js 微服务架构设计',
                'description': '学习如何使用Node.js构建可扩展的微服务架构，包括服务发现、负载均衡、监控等。',
                'tags': 'Node.js,微服务,后端架构,JavaScript',
                'filename': 'nodejs_microservices.mp4',
                'cover_image': None,
                'duration': 5100,  # 1小时25分钟
                'status': 'approved'
            },
            {
                'title': 'CSS Grid 布局完全教程',
                'description': '深入学习CSS Grid布局系统，创建复杂而灵活的网页布局。',
                'tags': 'CSS,前端开发,布局,Web设计',
                'filename': 'css_grid_tutorial.mp4',
                'cover_image': None,
                'duration': 1800,  # 30分钟
                'status': 'approved'
            },
            {
                'title': 'API 设计最佳实践',
                'description': '学习RESTful API的设计原则和最佳实践，包括接口设计、文档、测试等。',
                'tags': 'API,REST,后端开发,软件架构',
                'filename': 'api_design_best_practices.mp4',
                'cover_image': None,
                'duration': 2700,  # 45分钟
                'status': 'approved'
            },
            {
                'title': 'Webpack 5 配置与优化',
                'description': '掌握Webpack 5的配置和性能优化技巧，提升前端项目的构建效率。',
                'tags': 'Webpack,前端工程化,构建工具,JavaScript',
                'filename': 'webpack5_optimization.mp4',
                'cover_image': None,
                'duration': 3000,  # 50分钟
                'status': 'approved'
            },
            {
                'title': 'TypeScript 高级类型系统',
                'description': '深入理解TypeScript的高级类型系统，包括泛型、条件类型、映射类型等。',
                'tags': 'TypeScript,JavaScript,类型系统,前端开发',
                'filename': 'typescript_advanced_types.mp4',
                'cover_image': None,
                'duration': 3600,  # 1小时
                'status': 'approved'
            }
        ]
        
        # 添加更多测试视频以测试分页
        additional_videos = []
        for i in range(16, 50):  # 添加35个额外视频，总共50个
            additional_videos.append({
                'title': f'测试视频 #{i} - 技术分享',
                'description': f'这是第{i}个测试视频，用于测试分页功能的正常工作。内容涵盖各种技术话题和编程实践。',
                'tags': f'测试,技术,视频#{i},分享',
                'filename': f'test_video_{i}.mp4',
                'cover_image': None,
                'duration': random.randint(1800, 7200),  # 30分钟到2小时随机
                'status': 'approved'
            })
        
        all_videos = test_videos + additional_videos
        
        # 创建视频记录
        created_count = 0
        for video_data in all_videos:
            # 检查是否已存在相同标题的视频
            existing_video = Video.query.filter_by(title=video_data['title']).first()
            if existing_video:
                print(f"视频已存在，跳过: {video_data['title']}")
                continue
            
            video = Video(
                title=video_data['title'],
                description=video_data['description'],
                tags=video_data['tags'],
                filename=video_data['filename'],
                cover_image=video_data['cover_image'],
                duration=video_data['duration'],
                status=video_data['status'],
                view_count=random.randint(100, 10000),  # 随机观看次数
                user_id=user.id,
                created_at=datetime.utcnow()
            )
            
            db.session.add(video)
            created_count += 1
            
            if created_count % 10 == 0:
                print(f"已创建 {created_count} 个视频...")
        
        try:
            db.session.commit()
            print(f"✅ 成功添加 {created_count} 个测试视频!")
            print(f"📊 数据库中现有视频总数: {Video.query.count()}")
            
            # 显示分页信息
            total_videos = Video.query.filter_by(status='approved').count()
            per_page = 12
            total_pages = (total_videos + per_page - 1) // per_page
            print(f"📄 分页信息: 每页 {per_page} 个视频，共 {total_pages} 页")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ 添加视频失败: {e}")

if __name__ == '__main__':
    create_test_videos()
