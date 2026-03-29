from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # user, admin
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    videos = db.relationship('Video', backref='author', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Video(db.Model):
    __tablename__ = 'videos'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text)
    tags = db.Column(db.String(500))  # comma-separated tags
    filename = db.Column(db.String(255), nullable=False)
    cover_image = db.Column(db.String(255))
    file_size = db.Column(db.BigInteger)
    duration = db.Column(db.Integer)  # in seconds
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    view_count = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    source_url = db.Column(db.String(500))  # for scraped videos
    is_scraped = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'tags': self.tags.split(',') if self.tags else [],
            'filename': self.filename,
            'cover_image': self.cover_image,
            'file_size': self.file_size,
            'duration': self.duration,
            'status': self.status,
            'view_count': self.view_count,
            'user_id': self.user_id,
            'author': self.author.username if self.author else None,
            'source_url': self.source_url,
            'is_scraped': self.is_scraped,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ScrapedVideoInfo(db.Model):
    """Temporary storage for scraped video info before saving"""
    __tablename__ = 'scraped_videos'
    
    id = db.Column(db.Integer, primary_key=True)
    source_url = db.Column(db.String(500), nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    cover_url = db.Column(db.String(500))
    video_url = db.Column(db.String(500))
    scraped_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, imported, rejected
