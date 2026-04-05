import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self.storage: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()

        with self.lock:
            queue = self.storage[key]

            while queue and queue[0] <= now - window_seconds:
                queue.popleft()

            if len(queue) >= limit:
                retry_after = int(window_seconds - (now - queue[0]))
                return False, max(retry_after, 1)

            queue.append(now)
            return True, 0


rate_limiter = InMemoryRateLimiter()


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def build_rate_limit_dependency(
    scope_name: str,
    limit: int,
    window_seconds: int,
):
    def dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        key = f"{scope_name}:{client_ip}"

        allowed, retry_after = rate_limiter.hit(key, limit, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {scope_name}. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency