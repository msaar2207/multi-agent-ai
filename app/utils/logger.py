import os
import logging
from logging.handlers import RotatingFileHandler

LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Define log file paths
LOG_FILES = {
    "debug": os.path.join(LOG_DIR, "debug.log"),
    "info": os.path.join(LOG_DIR, "info.log"),
    "warning": os.path.join(LOG_DIR, "warning.log"),
    "error": os.path.join(LOG_DIR, "error.log"),
}

# Set up base logger
logger = logging.getLogger("quran_logger")
logger.setLevel(logging.DEBUG)

# Formatter for all logs
formatter = logging.Formatter(
    "[%(asctime)s] [%(levelname)s] [%(module)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# Create handlers for each log level
levels = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR
}

for level_name, level in levels.items():
    handler = RotatingFileHandler(LOG_FILES[level_name], maxBytes=2_000_000, backupCount=5)
    handler.setLevel(level)
    handler.setFormatter(formatter)
    # Filter to allow only that level
    handler.addFilter(lambda record, lvl=level: record.levelno == lvl)
    logger.addHandler(handler)
