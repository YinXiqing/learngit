import logging
import structlog

def setup_logging():
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )
    # 让 uvicorn/sqlalchemy 的日志也走 structlog 格式
    logging.basicConfig(format="%(message)s", level=logging.INFO)

logger = structlog.get_logger()
