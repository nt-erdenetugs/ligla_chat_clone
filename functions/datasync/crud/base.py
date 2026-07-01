from db import get_db_session
from sqlalchemy import MetaData


class CRUDDataSync:
    _metadata_cache: MetaData | None = None

    @classmethod
    def get_metadata(cls) -> MetaData:
        if cls._metadata_cache is None:
            SessionLocal, metadata, _ = get_db_session()
            if metadata is None:
                metadata = MetaData()
                metadata.reflect(bind=SessionLocal.bind)
            cls._metadata_cache = metadata
        return cls._metadata_cache
