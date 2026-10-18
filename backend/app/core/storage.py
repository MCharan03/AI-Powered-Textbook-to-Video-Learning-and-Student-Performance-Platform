import os
import shutil
import uuid
from abc import ABC, abstractmethod
from typing import Optional


class StorageProvider(ABC):
    """
    Abstract storage provider interface for object and asset storage.
    Supports local filesystem development storage and cloud object storage (e.g. AWS S3).
    """

    @abstractmethod
    def save_file(self, content: bytes, filename: str, folder: str = "uploads") -> str:
        """
        Saves file content and returns a storage key.
        """
        pass

    @abstractmethod
    def get_url(self, storage_key: str) -> str:
        """
        Returns a URL or public/signed path for the stored asset.
        """
        pass

    @abstractmethod
    def get_local_path(self, storage_key: str) -> Optional[str]:
        """
        Returns local filesystem path if available, or None.
        """
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """
        Deletes a file given its storage key.
        """
        pass


class LocalStorageProvider(StorageProvider):
    """
    Local filesystem storage implementation for development.
    """

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            # Default to backend/uploads
            self.base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
        else:
            self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def save_file(self, content: bytes, filename: str, folder: str = "uploads") -> str:
        target_dir = os.path.join(self.base_dir, folder) if folder != "uploads" else self.base_dir
        os.makedirs(target_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_{os.path.basename(filename)}"
        file_path = os.path.join(target_dir, unique_name)
        with open(file_path, "wb") as f:
            f.write(content)
        # Storage key is relative to base_dir or namespaced
        return f"{folder}/{unique_name}" if folder != "uploads" else unique_name

    def get_url(self, storage_key: str) -> str:
        if not storage_key:
            return ""
        if storage_key.startswith("http://") or storage_key.startswith("https://") or storage_key.startswith("/static/"):
            return storage_key
        if storage_key.startswith("/assets/"):
            return storage_key
        clean_key = storage_key.lstrip("/")
        return f"/assets/{clean_key}"

    def get_local_path(self, storage_key: str) -> Optional[str]:
        full_path = os.path.join(self.base_dir, storage_key)
        return full_path if os.path.exists(full_path) else None

    def delete_file(self, storage_key: str) -> bool:
        full_path = os.path.join(self.base_dir, storage_key)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                return True
            except OSError:
                return False
        return False


class S3StorageProvider(StorageProvider):
    """
    AWS S3 Cloud Object Storage implementation stub.
    Ready for AWS S3 and CloudFront integration in subsequent build.
    """

    def __init__(self, bucket_name: str, region: str = "us-east-1", cdn_domain: Optional[str] = None):
        self.bucket_name = bucket_name
        self.region = region
        self.cdn_domain = cdn_domain

    def save_file(self, content: bytes, filename: str, folder: str = "uploads") -> str:
        storage_key = f"{folder}/{uuid.uuid4().hex}_{os.path.basename(filename)}"
        # In full production build, boto3.client('s3').put_object(...) is invoked here
        return storage_key

    def get_url(self, storage_key: str) -> str:
        if self.cdn_domain:
            return f"https://{self.cdn_domain}/{storage_key}"
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{storage_key}"

    def get_local_path(self, storage_key: str) -> Optional[str]:
        return None

    def delete_file(self, storage_key: str) -> bool:
        # In full production build, boto3.client('s3').delete_object(...) is invoked here
        return True


# Default instance
_storage_instance: Optional[StorageProvider] = None


def get_storage() -> StorageProvider:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = LocalStorageProvider()
    return _storage_instance
