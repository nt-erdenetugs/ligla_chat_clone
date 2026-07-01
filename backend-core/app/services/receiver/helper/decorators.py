import asyncio
import functools
from collections.abc import Awaitable, Callable
from typing import overload

from fastapi import HTTPException

from app.common.errors import ReceiverError, handle_error


@overload
def handle_receiver_errors[**P, T](func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]: ...


@overload
def handle_receiver_errors[**P, T](func: Callable[P, T]) -> Callable[P, T]: ...


def handle_receiver_errors[**P, T](
    func: Callable[P, T] | Callable[P, Awaitable[T]],
) -> Callable[P, T] | Callable[P, Awaitable[T]]:

    @functools.wraps(func)
    async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            result = await func(*args, **kwargs)  # type: ignore[misc]
            return result  # type: ignore[return-value]
        except ReceiverError:
            raise
        except HTTPException:
            raise
        except Exception as e:
            raise handle_error(e)

    @functools.wraps(func)
    def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return func(*args, **kwargs)  # type: ignore[return-value]
        except ReceiverError:
            raise
        except HTTPException:
            raise
        except Exception as e:
            raise handle_error(e)

    if asyncio.iscoroutinefunction(func):
        return async_wrapper  # type: ignore[return-value]
    else:
        return sync_wrapper  # type: ignore[return-value]
