"""Unit tests for RegistryCard model and LifecycleStatus enum."""

import pytest
from datetime import datetime, UTC
from pydantic import ValidationError

from registry.schemas.registry_card import (
    LifecycleStatus,
    RegistryCard,
    RegistryCapabilities,
    RegistryAuthConfig,
    RegistryContact,
)


@pytest.mark.unit
class TestLifecycleStatus:
    """Tests for LifecycleStatus enum."""

    def test_all_values_defined(self):
        """Test that all expected lifecycle status values are defined."""
        assert LifecycleStatus.ACTIVE == "active"
        assert LifecycleStatus.DEPRECATED == "deprecated"
        assert LifecycleStatus.DRAFT == "draft"
        assert LifecycleStatus.BETA == "beta"

    def test_enum_values_are_strings(self):
        """Test that enum values are strings."""
        for status in LifecycleStatus:
            assert isinstance(status.value, str)


@pytest.mark.unit
class TestRegistryCapabilities:
    """Tests for RegistryCapabilities model."""

    def test_default_values(self):
        """Test default values for capabilities."""
        caps = RegistryCapabilities()
        assert caps.servers is True
        assert caps.agents is True
        assert caps.skills is True
        assert caps.prompts is False
        assert caps.security_scans is True
        assert caps.incremental_sync is False
        assert caps.webhooks is False

    def test_custom_values(self):
        """Test custom capability values."""
        caps = RegistryCapabilities(
            servers=False,
            agents=True,
            skills=False,
            webhooks=True,
        )
        assert caps.servers is False
        assert caps.agents is True
        assert caps.skills is False
        assert caps.webhooks is True

    def test_json_serialization(self):
        """Test JSON serialization round-trip."""
        caps = RegistryCapabilities(servers=False, incremental_sync=True)
        json_data = caps.model_dump(mode="json")
        assert json_data["servers"] is False
        assert json_data["incremental_sync"] is True

        # Round-trip
        restored = RegistryCapabilities(**json_data)
        assert restored.servers is False
        assert restored.incremental_sync is True


@pytest.mark.unit
class TestRegistryAuthConfig:
    """Tests for RegistryAuthConfig model."""

    def test_default_values(self):
        """Test default values for authentication."""
        auth = RegistryAuthConfig()
        assert auth.schemes == ["oauth2", "bearer"]
        assert auth.oauth2_issuer is None
        assert auth.oauth2_token_endpoint is None
        assert auth.scopes_supported == ["federation/read"]

    def test_custom_values(self):
        """Test custom authentication values."""
        auth = RegistryAuthConfig(
            schemes=["bearer"],
            oauth2_issuer="https://auth.example.com",
            oauth2_token_endpoint="https://auth.example.com/token",
            scopes_supported=["read", "write"],
        )
        assert auth.schemes == ["bearer"]
        assert auth.oauth2_issuer == "https://auth.example.com"
        assert auth.oauth2_token_endpoint == "https://auth.example.com/token"
        assert auth.scopes_supported == ["read", "write"]

    def test_json_serialization(self):
        """Test JSON serialization round-trip."""
        auth = RegistryAuthConfig(schemes=["api_key"], oauth2_issuer="https://auth.test.com")
        json_data = auth.model_dump(mode="json")
        assert json_data["schemes"] == ["api_key"]
        assert json_data["oauth2_issuer"] == "https://auth.test.com"

        # Round-trip
        restored = RegistryAuthConfig(**json_data)
        assert restored.schemes == ["api_key"]
        assert restored.oauth2_issuer == "https://auth.test.com"


@pytest.mark.unit
class TestRegistryContact:
    """Tests for RegistryContact model."""

    def test_default_values(self):
        """Test default values for contact."""
        contact = RegistryContact()
        assert contact.email is None
        assert contact.url is None

    def test_with_email_and_url(self):
        """Test contact with email and URL."""
        contact = RegistryContact(
            email="admin@example.com",
            url="https://example.com/contact",
        )
        assert contact.email == "admin@example.com"
        assert contact.url == "https://example.com/contact"

    def test_json_serialization(self):
        """Test JSON serialization round-trip."""
        contact = RegistryContact(email="test@example.com", url="https://test.com")
        json_data = contact.model_dump(mode="json")
        assert json_data["email"] == "test@example.com"
        assert json_data["url"] == "https://test.com"

        # Round-trip
        restored = RegistryContact(**json_data)
        assert restored.email == "test@example.com"
        assert restored.url == "https://test.com"


@pytest.mark.unit
class TestRegistryCard:
    """Tests for RegistryCard model."""

    def test_minimal_valid_card(self):
        """Test creating a card with minimal required fields."""
        card = RegistryCard(
            registry_id="test-registry",
            name="Test Registry",
            federation_endpoint="https://registry.example.com/api/v1/federation",
        )
        assert card.registry_id == "test-registry"
        assert card.name == "Test Registry"
        assert card.schema_version == "1.0.0"
        assert card.description is None
        assert card.contact is None
        assert isinstance(card.capabilities, RegistryCapabilities)
        assert isinstance(card.authentication, RegistryAuthConfig)
        assert card.metadata == {}

    def test_full_card_with_all_fields(self):
        """Test creating a card with all fields populated."""
        contact = RegistryContact(
            email="admin@example.com",
            url="https://example.com/contact",
        )
        card = RegistryCard(
            schema_version="1.1.0",
            registry_id="full-registry",
            name="Full Registry",
            description="A comprehensive test registry",
            federation_api_version="2.0",
            federation_endpoint="https://full.example.com/api/v1/federation",
            contact=contact,
            capabilities=RegistryCapabilities(servers=True, agents=False),
            authentication=RegistryAuthConfig(schemes=["bearer"], oauth2_issuer="https://auth.test.com"),
            visibility_policy="authenticated",
            metadata={"region": "us-east-1", "tier": "production"},
        )
        assert card.registry_id == "full-registry"
        assert card.name == "Full Registry"
        assert card.description == "A comprehensive test registry"
        assert card.contact.email == "admin@example.com"
        assert card.contact.url == "https://example.com/contact"
        assert card.capabilities.servers is True
        assert card.capabilities.agents is False
        assert card.authentication.schemes == ["bearer"]
        assert card.visibility_policy == "authenticated"
        assert card.metadata == {"region": "us-east-1", "tier": "production"}

    def test_missing_required_fields(self):
        """Test that missing required fields raise validation errors."""
        with pytest.raises(ValidationError) as exc_info:
            RegistryCard()

        errors = exc_info.value.errors()
        required_fields = {error["loc"][0] for error in errors if error["type"] == "missing"}
        assert "registry_id" in required_fields
        assert "name" in required_fields
        assert "federation_endpoint" in required_fields

    def test_description_max_length_validation(self):
        """Test description field max length validation."""
        long_description = "x" * 1001
        with pytest.raises(ValidationError) as exc_info:
            RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="https://example.com/api/v1/federation",
                description=long_description,
            )

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("description",) for error in errors)

    def test_description_within_length_limit(self):
        """Test description field with exactly 1000 characters."""
        description_1000 = "x" * 1000
        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://example.com/api/v1/federation",
            description=description_1000,
        )
        assert len(card.description) == 1000

    def test_https_endpoint_validation(self):
        """Test that federation_endpoint must use HTTPS."""
        with pytest.raises(ValidationError) as exc_info:
            RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="http://insecure.example.com/api/v1/federation",
            )

        errors = exc_info.value.errors()
        assert any("must use HTTPS protocol" in str(error) for error in errors)

    def test_valid_https_endpoint(self):
        """Test that HTTPS endpoints are accepted."""
        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://secure.example.com/api/v1/federation",
        )
        # HttpUrl adds trailing slash automatically
        assert str(card.federation_endpoint).startswith("https://secure.example.com/api/v1/federation")

    def test_visibility_policy_validation(self):
        """Test visibility_policy validation."""
        # Valid policies
        for policy in ["public_only", "authenticated", "private"]:
            card = RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="https://example.com/api/v1/federation",
                visibility_policy=policy,
            )
            assert card.visibility_policy == policy

        # Invalid policy
        with pytest.raises(ValidationError) as exc_info:
            RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="https://example.com/api/v1/federation",
                visibility_policy="invalid_policy",
            )

        errors = exc_info.value.errors()
        assert any("visibility_policy" in str(error) for error in errors)

    def test_metadata_size_limit_validation(self):
        """Test metadata field size limit validation (10KB)."""
        # Create metadata that exceeds 10KB when serialized
        large_metadata = {f"key_{i}": "x" * 100 for i in range(200)}

        with pytest.raises(ValidationError) as exc_info:
            RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="https://example.com/api/v1/federation",
                metadata=large_metadata,
            )

        errors = exc_info.value.errors()
        assert any("exceeds 10KB size limit" in str(error) for error in errors)

    def test_metadata_within_size_limit(self):
        """Test metadata field within size limit."""
        # Create metadata under 10KB
        metadata = {f"key_{i}": "value" for i in range(100)}
        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://example.com/api/v1/federation",
            metadata=metadata,
        )
        assert len(card.metadata) == 100

    def test_json_serialization_round_trip(self):
        """Test JSON serialization and deserialization."""
        contact = RegistryContact(email="admin@example.com", url="https://example.com/contact")
        original = RegistryCard(
            registry_id="test-registry",
            name="Test Registry",
            description="Test description",
            federation_endpoint="https://registry.example.com/api/v1/federation",
            contact=contact,
            metadata={"region": "us-west-2"},
        )

        # Serialize to JSON
        json_data = original.model_dump(mode="json")

        # Deserialize back
        restored = RegistryCard(**json_data)

        # Verify fields match
        assert restored.registry_id == original.registry_id
        assert restored.name == original.name
        assert restored.description == original.description
        assert str(restored.federation_endpoint) == str(original.federation_endpoint)
        assert restored.contact.email == original.contact.email
        assert restored.metadata == original.metadata

    def test_unicode_in_text_fields(self):
        """Test handling of unicode characters in text fields."""
        card = RegistryCard(
            registry_id="unicode-test",
            name="Test Registry 测试 🚀",
            description="Description with unicode: 日本語, العربية, 한글",
            federation_endpoint="https://example.com/api/v1/federation",
        )
        assert "测试" in card.name
        assert "日本語" in card.description

    def test_default_capabilities_and_authentication(self):
        """Test that default capabilities and authentication are set."""
        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://example.com/api/v1/federation",
        )

        # Verify default capabilities
        assert card.capabilities.servers is True
        assert card.capabilities.agents is True
        assert card.capabilities.skills is True
        assert card.capabilities.security_scans is True

        # Verify default authentication
        assert card.authentication.schemes == ["oauth2", "bearer"]
        assert card.authentication.scopes_supported == ["federation/read"]

    def test_invalid_url_format(self):
        """Test that invalid URL formats raise validation errors."""
        with pytest.raises(ValidationError):
            RegistryCard(
                registry_id="test",
                name="Test",
                federation_endpoint="not-a-valid-url",
            )

    def test_timestamps_are_optional(self):
        """Test that created_at and updated_at are optional."""
        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://example.com/api/v1/federation",
        )
        assert card.created_at is None
        assert card.updated_at is None

    def test_timestamps_with_values(self):
        """Test setting timestamp values."""
        created = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        updated = datetime(2024, 1, 15, 0, 0, 0, tzinfo=UTC)

        card = RegistryCard(
            registry_id="test",
            name="Test",
            federation_endpoint="https://example.com/api/v1/federation",
            created_at=created,
            updated_at=updated,
        )
        assert card.created_at == created
        assert card.updated_at == updated
