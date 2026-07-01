import argparse
import os

from google.cloud import secretmanager

parser = argparse.ArgumentParser()
parser.add_argument("--create", help="Copy .env.prd to Secret Manager", action="store_true")
parser.add_argument("--update", help="Update .env.prd in Secret Manager", action="store_true")
parser.add_argument("--access", help="Access latest .env.prd from Secret Manager", action="store_true")
args = parser.parse_args()


def create_secret(project_id: str, secret_id: str):
    client = secretmanager.SecretManagerServiceClient()

    parent = f"projects/{project_id}"
    response = client.create_secret(
        request={
            "parent": parent,
            "secret_id": secret_id,
            "secret": {"replication": {"automatic": {}}},
        }
    )

    print(f"Created secret: {response.name}")


def add_secret_version(project_id: str, secret_id: str):
    client = secretmanager.SecretManagerServiceClient()

    parent = client.secret_path(project_id, secret_id)

    with open("/tmp/keys/.env.prd") as f:
        payload = f.read().encode("UTF-8")

    response = client.add_secret_version(request={"parent": parent, "payload": {"data": payload}})

    print(f"Added secret version: {response.name}")


def access_secret_version(project_id: str, secret_id: str, version_id: str):
    client = secretmanager.SecretManagerServiceClient()

    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})

    payload = response.payload.data.decode("UTF-8")
    print(f"Plaintext: {payload}")


if __name__ == "__main__":
    project_id = os.environ.get("GCP_PROJECT_ID")
    secret_id = "CHAT_ENV"
    version_id = "latest"

    if not project_id:
        raise Exception("GCP_PROJECT_ID not provided")

    if args.create:
        create_secret(project_id=project_id, secret_id=secret_id)

    if args.update:
        add_secret_version(
            project_id=project_id,
            secret_id=secret_id,
        )

    if args.access:
        access_secret_version(
            project_id=project_id,
            secret_id=secret_id,
            version_id=version_id,
        )

    print("Done")
