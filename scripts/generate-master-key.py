import secrets
import base64

def generate_master_key():
    """Generate a 256-bit master key for HKDF-derived pgcrypto org keys."""
    key = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')

    print("MASTER ENCRYPTION KEY:")
    print(key)
    print("\nStore this key in a secure vault immediately!")

if __name__ == "__main__":
    generate_master_key()
