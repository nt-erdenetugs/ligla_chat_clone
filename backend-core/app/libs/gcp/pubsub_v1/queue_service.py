import json
import socket
import time
from collections.abc import Callable
from typing import Any

from google.api_core.exceptions import AlreadyExists, NotFound
from google.api_core.retry import Retry
from google.cloud import pubsub_v1
from google.pubsub_v1 import DeadLetterPolicy, PushConfig, Subscription, Topic
from pydantic import BaseModel

from app.common.errors import PubSubNotFoundError, PubSubPublishError, PubSubServiceUnavailableError, raise_error
from app.common.utils import get_logger
from app.config.settings import AppENV, Settings

logger = get_logger(__name__)

MAX_DELIVERY_ATTEMPTS = 5


class BasePubSubConfig(BaseModel):
    topic_name: str
    subscription_name: str
    dlq_topic_name: str
    dlq_subscription_name: str


class QueueService:
    def __init__(self, settings: Settings, topic_config: BasePubSubConfig):
        self.settings: Settings = settings
        self.project_id: str = settings.GCP_PROJECT_ID
        self.topic_name: str = topic_config.topic_name
        self.subscription_name: str = topic_config.subscription_name
        self.dlq_topic_name: str = topic_config.dlq_topic_name
        self.dlq_subscription_name: str = topic_config.dlq_subscription_name
        self.pubsub_host: str = settings.PUBSUB_EMULATOR_HOST
        self._publisher_client: pubsub_v1.PublisherClient | None = None
        self._subscriber_client: pubsub_v1.SubscriberClient | None = None
        self._dlq_subscriber_client: pubsub_v1.SubscriberClient | None = None

    @property
    def publisher_client(self) -> pubsub_v1.PublisherClient:
        if self._publisher_client is None:
            if self.settings.ENV == AppENV.LOCAL and self.pubsub_host:
                self._publisher_client = pubsub_v1.PublisherClient()
            else:
                # Use production configuration for non-local environments
                self._publisher_client = pubsub_v1.PublisherClient()
        return self._publisher_client

    @property
    def subscriber_client(self) -> pubsub_v1.SubscriberClient:
        if self._subscriber_client is None:
            if self.settings.ENV == AppENV.LOCAL and self.pubsub_host:
                self._subscriber_client = pubsub_v1.SubscriberClient()
            else:
                # Use production configuration for non-local environments
                self._subscriber_client = pubsub_v1.SubscriberClient()
        return self._subscriber_client

    @property
    def dlq_subscriber_client(self) -> pubsub_v1.SubscriberClient:
        if self._dlq_subscriber_client is None:
            if self.settings.ENV == AppENV.LOCAL and self.pubsub_host:
                self._dlq_subscriber_client = pubsub_v1.SubscriberClient()
            else:
                # Use production configuration for non-local environments
                self._dlq_subscriber_client = pubsub_v1.SubscriberClient()
        return self._dlq_subscriber_client

    @property
    def topic_path(self):
        return self.publisher_client.topic_path(project=self.project_id, topic=self.topic_name)

    @property
    def subscription_path(self):
        return self.subscriber_client.subscription_path(self.project_id, self.subscription_name)

    @property
    def dlq_topic_path(self):
        return self.publisher_client.topic_path(project=self.project_id, topic=self.dlq_topic_name)

    # Topic Management
    def create_topic(self):
        self._create_topic_if_not_exists(self.topic_path, self.topic_name)
        self._create_topic_if_not_exists(self.dlq_topic_path, self.dlq_topic_name)

    def _create_topic_if_not_exists(self, topic_path: str, topic_name: str):
        try:
            self.publisher_client.create_topic(name=topic_path)
            logger.info(f"Topic {topic_name} created.")
        except AlreadyExists:
            logger.info(f"Topic {topic_name} already exists.")

    # Subscription Management
    def create_topic_and_subscription(self, push_endpoint: str | None = None):
        # Only check emulator in local environment
        if self.settings.ENV == AppENV.LOCAL and self.pubsub_host and not self._is_emulator_accessible():
            logger.warning("Pub/Sub emulator is not accessible. Skipping topic and subscription creation.")
            return

        self.create_topic()
        dead_letter_policy = self._create_dead_letter_policy()

        try:
            subscription = self._create_subscription(dead_letter_policy, push_endpoint)
            self.create_dlq_subscription()
            self._log_subscription_details(subscription, push_endpoint)
        except AlreadyExists:
            logger.info(f"Subscription {self.subscription_name} already exists.")
        except Exception as e:
            logger.error(f"Failed to create subscription {self.subscription_name}: {e}")
            raise

    def _create_dead_letter_policy(self) -> DeadLetterPolicy:
        return DeadLetterPolicy(
            dead_letter_topic=self.dlq_topic_path,
            max_delivery_attempts=MAX_DELIVERY_ATTEMPTS,
        )

    def _create_subscription(self, dead_letter_policy: DeadLetterPolicy, push_endpoint: str | None = None):
        with self.subscriber_client:
            request: dict[str, str | DeadLetterPolicy | PushConfig] = {
                "name": self.subscription_path,
                "topic": self.topic_path,
                "dead_letter_policy": dead_letter_policy,
            }
            if push_endpoint:
                request["push_config"] = PushConfig(push_endpoint=push_endpoint)
            return self.subscriber_client.create_subscription(request)

    def create_dlq_subscription(self):
        dlq_subscription_path = self.subscriber_client.subscription_path(self.project_id, self.dlq_subscription_name)

        try:
            subscription = self.dlq_subscriber_client.create_subscription(
                request={
                    "name": dlq_subscription_path,
                    "topic": self.dlq_topic_path,
                }
            )
            logger.info(f"DLQ subscription {subscription.name} created.")
            return subscription
        except AlreadyExists:
            logger.info(f"DLQ subscription {self.dlq_subscription_name} already exists.")
            return None
        except Exception as e:
            logger.error(f"Failed to create DLQ subscription: {e}")
            raise

    def _log_subscription_details(self, subscription: Subscription, push_endpoint: str | None = None):
        logger.info(f"Subscription {subscription.name} created.")
        if push_endpoint:
            logger.info(f"Push endpoint: {subscription.push_config.push_endpoint}")
        logger.info(f"Dead letter topic: {subscription.dead_letter_policy.dead_letter_topic}")
        logger.info(f"Max delivery attempts: {subscription.dead_letter_policy.max_delivery_attempts}")

    def _is_emulator_accessible(self) -> bool:
        if not self.pubsub_host:
            logger.warning("PUBSUB_EMULATOR_HOST environment variable is not set.")
            return False

        host, port = self.pubsub_host.split(":")
        for attempt in range(5):
            try:
                socket.create_connection((host, int(port)), timeout=5)
                logger.info(f"Pub/Sub emulator is accessible at {self.pubsub_host}.")
                return True
            except (OSError, ValueError) as e:
                logger.warning(f"Attempt {attempt + 1}/5: Pub/Sub emulator not accessible: {e}")
                time.sleep(2)

        logger.error(f"Pub/Sub emulator is not accessible after 5 attempts at {self.pubsub_host}.")
        return False

    def publish_message(self, *, message_data: dict[str, Any], **attrs: Any) -> str:
        if self.settings.ENV != AppENV.LOCAL:
            self.validate_pubsub_resources()

        message_json = self._serialize_message(message_data)
        return self._publish_to_topic(message_json, **attrs)

    def _serialize_message(self, message_data: dict[str, Any]) -> bytes:
        try:
            return json.dumps(message_data).encode("utf-8")
        except Exception as e:
            raise_error(PubSubPublishError(e))

    def _publish_to_topic(self, message_json: bytes, **attrs: Any) -> str:
        try:
            retry_policy = Retry(deadline=10)
            future = self.publisher_client.publish(
                topic=self.topic_path, data=message_json, retry=retry_policy, **attrs
            )
            message_id = future.result()
            logger.info(f"Published message ID: {message_id}")
            return message_id
        except NotFound as e:
            raise_error(PubSubNotFoundError("topic", e))
        except Exception as e:
            raise_error(PubSubServiceUnavailableError(e))

    def validate_pubsub_resources(self):
        self._validate_resource(self.publisher_client.get_topic, self.topic_path, "Topic")
        self._validate_resource(self.subscriber_client.get_subscription, self.subscription_path, "Subscription")

    def _validate_resource(
        self, get_resource_func: Callable[..., Subscription | Topic], resource_path: str, resource_type: str
    ) -> None:
        try:
            resource = get_resource_func(
                request={"topic" if resource_type == "Topic" else "subscription": resource_path}
            )
            logger.info(f"{resource_type} found: {resource.name}")
        except NotFound as e:
            raise_error(PubSubNotFoundError(resource_type.lower(), e))
        except Exception as e:
            raise_error(PubSubServiceUnavailableError(e))

    def pull_messages_from_dlq(self, max_messages: int = 10) -> list[dict[str, Any]]:
        dlq_subscription_path = self.subscriber_client.subscription_path(self.project_id, self.dlq_subscription_name)

        try:
            response = self.dlq_subscriber_client.pull(
                request={
                    "subscription": dlq_subscription_path,
                    "max_messages": max_messages,
                }
            )

            messages: list[dict[str, Any]] = []
            for received_message in response.received_messages:
                message_data = json.loads(received_message.message.data.decode("utf-8"))

                attributes = dict(received_message.message.attributes)
                pull_attempts = int(attributes.get("pull_attempts", 0)) + 1

                attributes["pull_attempts"] = str(pull_attempts)
                attributes["last_pulled_at"] = str(int(time.time()))

                messages.append(
                    {
                        "ack_id": received_message.ack_id,
                        "message_id": received_message.message.message_id,
                        "data": message_data,
                        "attributes": attributes,
                        "publish_time": received_message.message.publish_time,
                        "pull_attempts": pull_attempts,
                    }
                )

                logger.info(f"Message {received_message.message.message_id} pulled from DLQ. Attempt: {pull_attempts}")

            logger.info(f"Pulled {len(messages)} messages from DLQ.")

            return messages
        except NotFound:
            logger.warning("DLQ subscription not found. Creating it now.")
            self.create_dlq_subscription()
            return []
        except Exception as e:
            raise_error(PubSubServiceUnavailableError(e))

    def acknowledge_dlq_message(self, ack_id: str) -> bool:
        dlq_subscription_path = self.subscriber_client.subscription_path(self.project_id, self.dlq_subscription_name)

        try:
            self.dlq_subscriber_client.acknowledge(
                request={
                    "subscription": dlq_subscription_path,
                    "ack_ids": [ack_id],
                }
            )
            logger.info(f"Acknowledged message {ack_id} from DLQ.")
            return True
        except Exception as e:
            logger.error(f"Failed to acknowledge message from DLQ: {e}")
            return False
