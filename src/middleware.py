from time import  time
from fastapi import Request

from src.logger import logger




async def log_request(request:Request, call_next):
    start = time()

    response = await call_next(request)

    process_time = time() - start

    log_info = {
        "method": request.method,
        "path": request.url.path,
        "headers": dict(request.headers),
        "client": request.client,
        "process_time": round(process_time, 2),
        "status_code": response.status_code,
    }

    logger.info(log_info)

    return response
