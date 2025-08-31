import logging, sys 
from logging.handlers import TimedRotatingFileHandler


logger  =  logging.getLogger(__name__)

# create formatter 
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# create handler 

file_handler = TimedRotatingFileHandler('app.log', when='D', interval=1, backupCount=7)
stream_handler = logging.StreamHandler(sys.stdout)


file_handler.setFormatter(formatter)
stream_handler.setFormatter(formatter)


# add the handlers to the handler 
logger.handlers = [file_handler, stream_handler]

# set the log level
logger.setLevel(logging.INFO)

