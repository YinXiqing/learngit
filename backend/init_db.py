"""
初始化数据库和创建默认管理员账号
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import User

def init_db():
    app = create_app()
    
    with app.app_context():
        # 创建所有表
        db.create_all()
        print("✅ 数据库表创建成功")
        
        # 检查是否已有管理员账号
        admin = User.query.filter_by(username='admin').first()
        
        if admin:
            print("ℹ️  管理员账号已存在")
        else:
            # 创建默认管理员账号
            admin = User(
                username='admin',
                email='admin@videoplatform.com',
                role='admin',
                is_active=True
            )
            admin.set_password('admin123')
            
            db.session.add(admin)
            db.session.commit()
            
            print("✅ 默认管理员账号创建成功")
            print("   用户名: admin")
            print("   密码: admin123")
        
        # 确保上传目录存在
        upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
            print(f"✅ 上传目录创建成功: {upload_dir}")
        else:
            print(f"ℹ️  上传目录已存在: {upload_dir}")
        
        print("\n🎉 初始化完成！")
        print("\n启动服务器:")
        print("   python run.py")
        print("\n默认访问地址:")
        print("   后端: http://localhost:5000")
        print("   前端: http://localhost:3000")

if __name__ == '__main__':
    try:
        init_db()
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        sys.exit(1)
