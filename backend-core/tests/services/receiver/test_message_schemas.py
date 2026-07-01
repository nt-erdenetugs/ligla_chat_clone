from app.services.receiver.schemas.message import Favorites, NewMessageRequest


class TestNewMessageRequestSchemas:
    def test_client_user_id_preserved(self):
        """Regression: clientUserId must not be dropped during schema instantiation."""
        req = NewMessageRequest(
            **{
                "messageType": "new",
                "clientName": "test_org",
                "userId": "U11111111111111111111111111111111",
                "timestamp": 1699868901,
                "clientUserId": "111111",
            }
        )
        assert req.client_user_id == "111111"

    def test_favorites_none_string_coerced_to_null(self):
        """Regression: operatorId='None' (string) must be coerced to None."""
        fav = Favorites(**{"operatorId": "None", "storeIds": []})
        assert fav.operator_id is None
