import os
import sys

# Add the backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import create_app, db
from app.models import User, Video, ScrapedVideoInfo

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Video': Video, 'ScrapedVideoInfo': ScrapedVideoInfo}

if __name__ == '__main__':
    # Ensure upload directory exists
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    
    # Create database directory
    db_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database')
    os.makedirs(db_dir, exist_ok=True)
    
    print("🎬 Starting Video Platform Server...")
    print("📱 Frontend: http://localhost:3000")
    print("🔧 API: http://localhost:5000")
    print("\nDefault admin credentials:")
    print("   Username: admin")
    print("   Password: admin123")
    print("\nPress Ctrl+C to stop the server")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
