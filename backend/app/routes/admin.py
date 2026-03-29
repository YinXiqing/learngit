from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Video, ScrapedVideoInfo
from app import db
from bs4 import BeautifulSoup
import requests
import re

admin_bp = Blueprint('admin', __name__)

def admin_required(fn):
    """Decorator to check if user is admin"""
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return fn(*args, **kwargs)
    
    wrapper.__name__ = fn.__name__
    return wrapper

# User Management
@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    """Get all users with pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = User.query
    
    if search:
        search_pattern = f'%{search}%'
        query = query.filter(
            db.or_(
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
    
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'users': [user.to_dict() for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update user status or role"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update role
    if 'role' in data and data['role'] in ['user', 'admin']:
        # Prevent changing own role
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot change your own role'}), 400
        user.role = data['role']
    
    # Update status
    if 'is_active' in data:
        # Prevent disabling own account
        current_user_id = get_jwt_identity()
        if user_id == current_user_id and not data['is_active']:
            return jsonify({'error': 'Cannot disable your own account'}), 400
        user.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'User updated successfully',
        'user': user.to_dict()
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete user and their videos"""
    user = User.query.get_or_404(user_id)
    
    # Prevent deleting own account
    current_user_id = get_jwt_identity()
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    # Delete user's videos (cascade delete)
    Video.query.filter_by(user_id=user_id).delete()
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'}), 200

# Video Management
@admin_bp.route('/videos', methods=['GET'])
@admin_required
def get_all_videos():
    """Get all videos for admin with filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'all')  # all, pending, approved, rejected
    search = request.args.get('search', '').strip()
    
    query = Video.query
    
    # Filter by status
    if status != 'all' and status in ['pending', 'approved', 'rejected']:
        query = query.filter_by(status=status)
    
    # Search
    if search:
        search_pattern = f'%{search}%'
        query = query.join(User).filter(
            db.or_(
                Video.title.ilike(search_pattern),
                Video.description.ilike(search_pattern),
                User.username.ilike(search_pattern)
            )
        )
    
    pagination = query.order_by(Video.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'videos': [video.to_dict() for video in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/videos/<int:video_id>', methods=['PUT'])
@admin_required
def update_video(video_id):
    """Update video information or status"""
    video = Video.query.get_or_404(video_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update fields
    if 'title' in data:
        video.title = data['title'].strip()
    
    if 'description' in data:
        video.description = data['description'].strip()
    
    if 'tags' in data:
        # Convert list to comma-separated string or strip if string
        if isinstance(data['tags'], list):
            video.tags = ','.join(data['tags'])
        else:
            video.tags = data['tags'].strip()
    
    if 'status' in data and data['status'] in ['pending', 'approved', 'rejected']:
        video.status = data['status']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Video updated successfully',
        'video': video.to_dict()
    }), 200

@admin_bp.route('/videos/bulk-update', methods=['POST'])
@admin_required
def bulk_update_videos():
    """Bulk update video status"""
    data = request.get_json()
    
    if not data or 'video_ids' not in data or 'status' not in data:
        return jsonify({'error': 'Video IDs and status are required'}), 400
    
    video_ids = data['video_ids']
    status = data['status']
    
    if status not in ['pending', 'approved', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400
    
    updated_count = Video.query.filter(Video.id.in_(video_ids)).update(
        {'status': status}, synchronize_session=False
    )
    
    db.session.commit()
    
    return jsonify({
        'message': f'{updated_count} videos updated successfully',
        'updated_count': updated_count
    }), 200

@admin_bp.route('/videos/<int:video_id>', methods=['DELETE'])
@admin_required
def delete_video(video_id):
    """Delete video"""
    video = Video.query.get_or_404(video_id)
    
    # Delete file from storage
    import os
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        video_path = os.path.join(upload_folder, video.filename)
        if os.path.exists(video_path):
            os.remove(video_path)
        
        if video.cover_image:
            cover_path = os.path.join(upload_folder, video.cover_image)
            if os.path.exists(cover_path):
                os.remove(cover_path)
    except Exception as e:
        print(f"Error deleting files: {e}")
    
    db.session.delete(video)
    db.session.commit()
    
    return jsonify({'message': 'Video deleted successfully'}), 200

@admin_bp.route('/videos/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_videos():
    """Bulk delete videos"""
    data = request.get_json()
    
    if not data or 'video_ids' not in data:
        return jsonify({'error': 'Video IDs are required'}), 400
    
    video_ids = data['video_ids']
    
    # Get videos to delete their files
    videos = Video.query.filter(Video.id.in_(video_ids)).all()
    
    import os
    upload_folder = current_app.config['UPLOAD_FOLDER']
    
    for video in videos:
        try:
            video_path = os.path.join(upload_folder, video.filename)
            if os.path.exists(video_path):
                os.remove(video_path)
            
            if video.cover_image:
                cover_path = os.path.join(upload_folder, video.cover_image)
                if os.path.exists(cover_path):
                    os.remove(cover_path)
        except Exception as e:
            print(f"Error deleting files for video {video.id}: {e}")
    
    # Delete from database
    deleted_count = Video.query.filter(Video.id.in_(video_ids)).delete(
        synchronize_session=False
    )
    
    db.session.commit()
    
    return jsonify({
        'message': f'{deleted_count} videos deleted successfully',
        'deleted_count': deleted_count
    }), 200

# Video Scraping
@admin_bp.route('/scrape', methods=['POST'])
@admin_required
def scrape_video():
    """Scrape video information from external URL"""
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({'error': 'URL is required'}), 400
    
    url = data['url'].strip()
    site = data.get('site', '91p')
    
    try:
        # Fetch the webpage
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # For 91p site, add server=line3 parameter to get alternative video line
        scrape_url = url
        if site == '91p' and '?' not in url:
            scrape_url = url + '?server=line3'
        elif site == '91p' and '?' in url:
            scrape_url = url + '&server=line3'
        
        print(f"Original URL: {url}")
        print(f"Scraping URL: {scrape_url}")
        print(f"Site: {site}")
        
        response = requests.get(scrape_url, headers=headers, timeout=15, verify=False)
        response.raise_for_status()
        
        print(f"Response status: {response.status_code}")
        print(f"Response content length: {len(response.content)}")
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        print(f"Parsed HTML with {len(soup.find_all())} elements")
        
        # Extract information based on site
        if site == '91p':
            title, description, cover_url, video_url = scrape_91p_video(soup, url)
        elif site == 'bilibili':
            title, description, cover_url, video_url = scrape_bilibili_video(soup, url)
        else:
            # Default scraping logic
            title, description, cover_url, video_url = scrape_generic_video(soup, url)
        
        print(f"Extracted - Title: {title[:50]}...")
        print(f"Extracted - Cover URL: {cover_url[:50] if cover_url else 'None'}...")
        print(f"Extracted - Video URL: {video_url[:50] if video_url else 'None'}...")
        
        # Validate extracted data
        if not title or title == 'Untitled Video':
            print("Warning: Could not extract proper title")
        
        if not cover_url:
            print("Warning: Could not extract cover URL")
        
        if not video_url:
            print("Warning: Could not extract video URL")
        
        # Create video info with extracted data
        video_info = {
            'source_url': url,
            'title': title,
            'description': description,
            'video_url': video_url,
            'cover_url': cover_url
        }
        
        # Save scraped info to database
        scraped = ScrapedVideoInfo(
            source_url=video_info['source_url'],
            title=video_info['title'],
            description=video_info['description'],
            video_url=video_info['video_url'],
            cover_url=video_info['cover_url']
        )
        db.session.add(scraped)
        db.session.commit()
        
        print(f"Saved to database - ID: {scraped.id}")
        print(f"Saved to database - Cover URL: {scraped.cover_url[:50] if scraped.cover_url else 'NONE'}")
        
        return jsonify({
            'message': 'Video information scraped successfully',
            'scraped_info': video_info,
            'scraped_id': scraped.id
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout. The website may be slow to respond or blocking requests.'}), 408
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Connection error. Could not connect to the website. Please check the URL and your network connection.'}), 503
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return jsonify({'error': 'Page not found (404). The URL may be incorrect or the page has been removed.'}), 404
        elif e.response.status_code == 403:
            return jsonify({'error': 'Access forbidden (403). The website may be blocking automated requests.'}), 403
        elif e.response.status_code == 429:
            return jsonify({'error': 'Too many requests (429). The website is rate-limiting requests. Please try again later.'}), 429
        else:
            return jsonify({'error': f'HTTP error {e.response.status_code}: {str(e)}'}), e.response.status_code
    except requests.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 500
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Scraping error details: {error_details}")
        return jsonify({'error': f'Scraping failed: {str(e)}'}), 500

@admin_bp.route('/scraped', methods=['GET'])
@admin_required
def get_scraped_videos():
    """Get list of scraped videos"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'pending')
    
    query = ScrapedVideoInfo.query
    if status != 'all':
        query = query.filter_by(status=status)
    
    pagination = query.order_by(ScrapedVideoInfo.scraped_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'scraped_videos': [{
            'id': v.id,
            'source_url': v.source_url,
            'title': v.title,
            'description': v.description,
            'cover_url': v.cover_url,
            'video_url': v.video_url,
            'scraped_at': v.scraped_at.isoformat() if v.scraped_at else None,
            'status': v.status
        } for v in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/scraped/<int:scraped_id>/import', methods=['POST'])
@admin_required
def import_scraped_video(scraped_id):
    """Import scraped video as a video record"""
    scraped = ScrapedVideoInfo.query.get_or_404(scraped_id)
    data = request.get_json() or {}
    
    # Create video record from scraped info
    video = Video(
        title=data.get('title', scraped.title) or 'Untitled Video',
        description=data.get('description', scraped.description) or '',
        source_url=scraped.video_url,  # 存储视频播放URL
        cover_image=scraped.cover_url,  # 存储封面图片URL
        is_scraped=True,
        user_id=get_jwt_identity(),
        status='approved',  # 直接审核通过
        filename='external_video',  # 占位符，表示外部视频
        file_size=0,
        duration=0
    )
    
    db.session.add(video)
    scraped.status = 'published'
    db.session.commit()
    
    return jsonify({
        'message': 'Video published successfully',
        'video': video.to_dict()
    }), 201

@admin_bp.route('/scraped/<int:scraped_id>', methods=['DELETE'])
@admin_required
def delete_scraped_video(scraped_id):
    """Delete scraped video record"""
    scraped = ScrapedVideoInfo.query.get_or_404(scraped_id)
    scraped.status = 'deleted'
    db.session.commit()
    
    return jsonify({
        'message': 'Scraped video deleted successfully'
    }), 200

# Statistics
@admin_bp.route('/stats', methods=['GET'])
@admin_required
def get_stats():
    """Get platform statistics"""
    total_users = User.query.count()
    total_videos = Video.query.count()
    pending_videos = Video.query.filter_by(status='pending').count()
    approved_videos = Video.query.filter_by(status='approved').count()
    total_views = db.session.query(db.func.sum(Video.view_count)).scalar() or 0
    
    return jsonify({
        'total_users': total_users,
        'total_videos': total_videos,
        'pending_videos': pending_videos,
        'approved_videos': approved_videos,
        'total_views': int(total_views)
    }), 200

# Scraping functions for different sites
def scrape_91p_video(soup, url):
    """Scrape video information from 91p website"""
    import re
    
    # Extract title - 使用描述信息作为标题
    title = 'Untitled Video'
    title_selectors = [
        ('div', {'class': 'video-description'}),
        ('.description', {}),
        ('.video-info', {}),
        ('meta', {'name': 'description'}),
        ('meta', {'property': 'og:description'}),
        ('.content', {}),
        ('.info', {})
    ]
    
    for tag, attrs in title_selectors:
        elem = soup.find(tag, attrs) if attrs else soup.find(tag)
        if elem:
            if tag == 'meta':
                title = elem.get('content', '').strip()
            else:
                title = elem.get_text().strip()
            if title and len(title) > 10:  # 确保有意义的标题
                break
    
    # 如果没有找到描述，使用网站标题作为备选
    if not title or title == 'Untitled Video':
        title_elem = soup.find('title')
        if title_elem:
            title = title_elem.get_text().strip()
    
    # Extract description - 使用更详细的信息
    description = ''
    desc_selectors = [
        ('div', {'class': 'video-description'}),
        ('.description', {}),
        ('.video-info', {}),
        ('.content', {}),
        ('.info', {}),
        ('meta', {'name': 'description'}),
        ('meta', {'property': 'og:description'}),
        ('meta', {'name': 'twitter:description'})
    ]
    
    for tag, attrs in desc_selectors:
        elem = soup.find(tag, attrs) if attrs else soup.find(tag)
        if elem:
            if tag == 'meta':
                description = elem.get('content', '').strip()
            else:
                description = elem.get_text().strip()
            if description:
                break
    
    # Extract cover image
    cover_url = ''
    cover_selectors = [
        ('video', {'poster': True}),
        ('video', {}),
        ('img', {'alt': re.compile(r'video|cover|thumb', re.I)}),
        ('meta', {'property': 'og:image'}),
        ('meta', {'name': 'twitter:image'}),
        ('.video-poster img', {}),
        ('.thumb img', {}),
        ('.poster img', {})
    ]
    
    for tag, attrs in cover_selectors:
        if isinstance(attrs, dict) and 'poster' in attrs:
            elem = soup.find(tag, poster=True)
        elif attrs:
            elem = soup.find(tag, attrs)
        else:
            elem = soup.find(tag)
            
        if elem:
            if tag == 'meta':
                cover_url = elem.get('content', '')
            elif tag == 'video':
                cover_url = elem.get('poster') or elem.get('src') or ''
            else:
                cover_url = elem.get('src') or elem.get('data-src') or ''
            if cover_url:
                break
    
    # Extract video URL - 从页面中提取M3U8地址
    video_url = ''
    
    # 方法1: 查找包含m3u8的script标签中的变量
    scripts = soup.find_all('script')
    for script in scripts:
        if script.string:
            # 查找 window.$avdt 或类似变量中的m3u8地址
            patterns = [
                r'window\.\$avdt\s*=\s*["\']([^"\']*\.m3u8[^"\']*)["\']',
                r'var\s+\w+\s*=\s*["\']([^"\']*\.m3u8[^"\']*)["\']',
                r'["\']([^"\']*\.m3u8[^"\']*)["\']',
                r'src:\s*["\']([^"\']*\.m3u8[^"\']*)["\']'
            ]
            for pattern in patterns:
                match = re.search(pattern, script.string, re.IGNORECASE)
                if match:
                    video_url = match.group(1)
                    print(f"✓ Found m3u8 in script: {video_url[:100]}")
                    break
            if video_url:
                break
    
    # 方法2: 查找video标签的src属性
    if not video_url:
        video_tag = soup.find('video', src=True)
        if video_tag:
            video_url = video_tag.get('src', '')
            if '.m3u8' in video_url:
                print(f"✓ Found m3u8 in video tag src: {video_url[:100]}")
    
    # 方法3: 查找source标签
    if not video_url:
        source_tag = soup.find('source', src=re.compile(r'\.m3u8', re.I))
        if source_tag:
            video_url = source_tag.get('src', '')
            print(f"✓ Found m3u8 in source tag: {video_url[:100]}")
    
    # 方法4: 在HTML中直接搜索m3u8链接
    if not video_url:
        html_content = str(soup)
        m3u8_patterns = [
            r'["\']([^"\']*\.m3u8[^"\']*)["\']',
            r'url\(["\']?([^"\']*\.m3u8[^"\']*)["\']?\)',
            r'src:\s*["\']([^"\']*\.m3u8[^"\']*)["\']'
        ]
        for pattern in m3u8_patterns:
            match = re.search(pattern, html_content, re.IGNORECASE)
            if match:
                video_url = match.group(1)
                print(f"✓ Found m3u8 in HTML: {video_url[:100]}")
                break
    
    # 备选: 如果找不到m3u8，仍然尝试获取嵌入代码
    if not video_url:
        embed_input = soup.find('input', attrs={'id': 'videoEmbedHtml'})
        if embed_input:
            video_url = embed_input.get('value', '')
            print(f"✓ Fallback to embed code: {video_url[:100]}")
    
    print(f"Final video URL: {video_url[:150] if video_url else 'NOT FOUND'}")
    return title, description, cover_url, video_url

def scrape_bilibili_video(soup, source_url):
    """Scrape Bilibili video information"""
    try:
        # 提取标题
        title_tag = soup.find('h1', {'class': 'video-title'})
        if not title_tag:
            title_tag = soup.find('title')
        title = title_tag.get_text().strip() if title_tag else 'Unknown Title'
        
        # 提取描述
        desc_tag = soup.find('meta', {'name': 'description'})
        description = desc_tag.get('content', '').strip() if desc_tag else ''
        
        # 提取封面 - 多种方法尝试
        cover_url = ''
        
        # 方法1: 从__INITIAL_STATE__数据中提取（最可靠）
        script_tags = soup.find_all('script')
        for script in script_tags:
            if script.string and 'window.__INITIAL_STATE__' in script.string:
                try:
                    import json
                    json_start = script.string.find('window.__INITIAL_STATE__') + len('window.__INITIAL_STATE__ = ')
                    json_end = script.string.find('};', json_start) + 1
                    json_data = json.loads(script.string[json_start:json_end])
                    
                    if 'videoData' in json_data:
                        video_data = json_data['videoData']
                        cover_url = video_data.get('pic', '') or video_data.get('cover', '')
                        if cover_url:
                            break
                except:
                    pass
        
        # 方法2: og:image meta标签
        if not cover_url:
            cover_tag = soup.find('meta', {'property': 'og:image'})
            if cover_tag:
                cover_url = cover_tag.get('content', '')
        
        # 方法3: 查找img标签
        if not cover_url:
            img_tag = soup.find('img', {'class': 'bilibili-player-video-poster'})
            if img_tag and img_tag.get('src'):
                cover_url = img_tag.get('src')
        
        # 确保封面URL是完整的和可访问的
        if cover_url:
            if cover_url.startswith('//'):
                cover_url = 'https:' + cover_url
            elif not cover_url.startswith('http'):
                cover_url = 'https:' + cover_url
            
            # 尝试使用更高清的封面
            if 'i0.hdslb.com' in cover_url or 'i1.hdslb.com' in cover_url or 'i2.hdslb.com' in cover_url:
                # 替换为更大的尺寸
                cover_url = cover_url.replace('@100w_100h_1c.webp', '@660w_660h_1c.webp')
                cover_url = cover_url.replace('@200w_200h_1c.webp', '@660w_660h_1c.webp')
                cover_url = cover_url.replace('@400w_400h_1c.webp', '@660w_660h_1c.webp')
        
        print(f"Bilibili cover extraction final URL: {cover_url[:100] if cover_url else 'NOT FOUND'}")
        
        # 提取视频URL - Bilibili使用iframe嵌入
        video_url = ''
        
        # 方法1: 从URL构造嵌入地址（最可靠）
        import re
        bv_match = re.search(r'BV[a-zA-Z0-9]+', source_url)
        if bv_match:
            bvid = bv_match.group(0)
            video_url = f"https://player.bilibili.com/player.html?bvid={bvid}&high_quality=1&danmaku=0"
        else:
            # 匹配AV号
            av_match = re.search(r'av(\d+)', source_url)
            if av_match:
                aid = av_match.group(1)
                video_url = f"https://player.bilibili.com/player.html?aid={aid}&high_quality=1&danmaku=0"
        
        # 方法2: 从页面数据中提取（备用）
        if not video_url:
            script_tags = soup.find_all('script')
            for script in script_tags:
                if script.string and 'window.__INITIAL_STATE__' in script.string:
                    try:
                        import json
                        json_start = script.string.find('window.__INITIAL_STATE__') + len('window.__INITIAL_STATE__ = ')
                        json_end = script.string.find('};', json_start) + 1
                        json_data = json.loads(script.string[json_start:json_end])
                        
                        if 'videoData' in json_data:
                            video_data = json_data['videoData']
                            bvid = video_data.get('bvid', '')
                            aid = video_data.get('aid', '')
                            if bvid:
                                video_url = f"https://player.bilibili.com/player.html?bvid={bvid}&high_quality=1&danmaku=0"
                            elif aid:
                                video_url = f"https://player.bilibili.com/player.html?aid={aid}&high_quality=1&danmaku=0"
                            break
                    except:
                        pass
        
        print(f"Bilibili video - Title: {title[:50]}")
        print(f"Bilibili video - Cover: {cover_url[:50] if cover_url else 'NOT FOUND'}")
        print(f"Bilibili video - URL: {video_url[:100] if video_url else 'NOT FOUND'}")
        
        return title, description, cover_url, video_url
        
    except Exception as e:
        print(f"Error scraping Bilibili video: {e}")
        return 'Error Title', '', '', ''

def scrape_generic_video(soup, url):
    """Generic video scraping logic"""
    # Extract title
    title_elem = soup.find('title') or soup.find('h1')
    title = title_elem.get_text().strip() if title_elem else 'Untitled Video'
    
    # Extract description
    desc_elem = soup.find('meta', attrs={'name': 'description'}) or soup.find('meta', attrs={'property': 'og:description'})
    description = desc_elem.get('content', '').strip() if desc_elem else ''
    
    # Extract cover image
    cover_elem = soup.find('meta', attrs={'property': 'og:image'}) or soup.find('link', attrs={'rel': 'image_src'})
    cover_url = cover_elem.get('content', '') if cover_elem else ''
    
    # Extract video URL
    video_elem = soup.find('meta', attrs={'property': 'og:video'}) or soup.find('meta', attrs={'name': 'twitter:player'})
    video_url = video_elem.get('content', '') if video_elem else ''
    
    return title, description, cover_url, video_url

@admin_bp.route('/scraped/batch-publish', methods=['POST'])
@admin_required
def batch_publish_scraped_videos():
    """Batch publish scraped videos"""
    try:
        data = request.get_json()
        video_ids = data.get('video_ids', [])
        
        if not video_ids:
            return jsonify({'error': 'No video IDs provided'}), 400
        
        success_count = 0
        error_count = 0
        
        for video_id in video_ids:
            try:
                scraped = ScrapedVideoInfo.query.get(video_id)
                if scraped and scraped.status == 'pending':
                    # Create video record from scraped info
                    video = Video(
                        title=scraped.title or 'Untitled Video',
                        description=scraped.description or '',
                        source_url=scraped.video_url,
                        cover_image=scraped.cover_url,
                        is_scraped=True,
                        user_id=get_jwt_identity(),
                        status='approved',
                        filename='external_video',
                        file_size=0,
                        duration=0
                    )
                    db.session.add(video)
                    scraped.status = 'published'
                    success_count += 1
                    print(f"Published video: {scraped.title[:30]}...")
                else:
                    error_count += 1
            except Exception as e:
                print(f"Error publishing video {video_id}: {e}")
                error_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully published {success_count} videos',
            'success_count': success_count,
            'error_count': error_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Batch publish error: {e}")
        return jsonify({'error': f'Batch publish failed: {str(e)}'}), 500

@admin_bp.route('/scraped/batch-delete', methods=['POST'])
@admin_required
def batch_delete_scraped_videos():
    """Batch delete scraped videos"""
    try:
        data = request.get_json()
        video_ids = data.get('video_ids', [])
        
        if not video_ids:
            return jsonify({'error': 'No video IDs provided'}), 400
        
        success_count = 0
        
        for video_id in video_ids:
            try:
                scraped = ScrapedVideoInfo.query.get(video_id)
                if scraped:
                    db.session.delete(scraped)
                    success_count += 1
            except:
                pass
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully deleted {success_count} videos',
            'success_count': success_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Batch delete error: {e}")
        return jsonify({'error': f'Batch delete failed: {str(e)}'}), 500

@admin_bp.route('/scrape/refresh-url', methods=['POST'])
@admin_required
def refresh_video_url():
    """Refresh video URL by parsing source page for latest m3u8 address"""
    try:
        data = request.get_json()
        source_url = data.get('source_url')
        site = data.get('site', '91p')
        
        if not source_url:
            return jsonify({'error': 'Source URL is required'}), 400
        
        print(f"Refreshing video URL for: {source_url}")
        print(f"Site: {site}")
        
        # Fetch the webpage to get latest m3u8 URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # For 91p site, add server=line3 parameter
        scrape_url = source_url
        if site == '91p' and '?' not in source_url:
            scrape_url = source_url + '?server=line3'
        elif site == '91p' and '?' in source_url:
            scrape_url = source_url + '&server=line3'
        
        response = requests.get(scrape_url, headers=headers, timeout=15, verify=False)
        response.raise_for_status()
        
        # Parse HTML for video URL
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Use existing scraping logic but only return video URL
        if site == '91p':
            title, description, cover_url, video_url = scrape_91p_video(soup, source_url)
        elif site == 'bilibili':
            title, description, cover_url, video_url = scrape_bilibili_video(soup, source_url)
        else:
            title, description, cover_url, video_url = scrape_generic_video(soup, source_url)
        
        print(f"Refreshed video URL: {video_url}")
        
        return jsonify({
            'video_url': video_url,
            'title': title,
            'description': description,
            'cover_url': cover_url
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout. The website may be slow to respond.'}), 408
    except requests.exceptions.ConnectionError:
        return jsonify({'error': 'Connection error. Could not connect to the website.'}), 503
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            return jsonify({'error': 'Page not found (404).'}), 404
        elif e.response.status_code == 403:
            return jsonify({'error': 'Access forbidden (403).'}), 403
        elif e.response.status_code == 429:
            return jsonify({'error': 'Too many requests (429).'}), 429
        else:
            return jsonify({'error': f'HTTP error {e.response.status_code}: {str(e)}'}), e.response.status_code
    except requests.RequestException as e:
        return jsonify({'error': f'Network error: {str(e)}'}), 500
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"URL refresh error details: {error_details}")
        return jsonify({'error': f'URL refresh failed: {str(e)}'}), 500

# Image proxy for CORS issues
@admin_bp.route('/proxy/image')
def proxy_image():
    """Proxy image requests to avoid CORS issues"""
    from flask import Response
    import requests
    
    image_url = request.args.get('url')
    if not image_url:
        print("Image proxy: No URL provided")
        return jsonify({'error': 'No URL provided'}), 400
    
    # 简单的URL验证，只允许特定域名
    allowed_domains = ['i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com', 'i3.hdslb.com', 
                   'hdslb.com', 'bilibili.com', 'sina.com.cn']
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(image_url)
        if not any(domain in parsed.netloc for domain in allowed_domains):
            print(f"Image proxy: Domain not allowed: {parsed.netloc}")
            return jsonify({'error': 'Domain not allowed'}), 403
    except:
        return jsonify({'error': 'Invalid URL'}), 400
    
    print(f"Image proxy: Requesting {image_url}")
    
    try:
        # Fetch the image
        response = requests.get(image_url, timeout=10, stream=True, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.bilibili.com/'
        })
        response.raise_for_status()
        
        # Determine content type
        content_type = response.headers.get('content-type', 'image/jpeg')
        print(f"Image proxy: Success, content-type: {content_type}, size: {len(response.content)} bytes")
        
        # Return the image with proper headers
        return Response(
            response.content,
            mimetype=content_type,
            headers={
                'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except requests.exceptions.Timeout:
        print(f"Image proxy: Timeout for {image_url}")
        return jsonify({'error': 'Request timeout'}), 408
    except requests.exceptions.ConnectionError:
        print(f"Image proxy: Connection error for {image_url}")
        return jsonify({'error': 'Connection error'}), 503
    except requests.exceptions.HTTPError as e:
        print(f"Image proxy: HTTP error {e.response.status_code} for {image_url}")
        return jsonify({'error': f'HTTP error {e.response.status_code}'}), e.response.status_code
    except Exception as e:
        print(f"Image proxy: Unexpected error for {image_url}: {e}")
        return jsonify({'error': 'Failed to fetch image'}), 500
