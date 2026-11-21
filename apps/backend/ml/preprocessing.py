"""Feature cleaning and preprocessing transformers (Phase 1 scaffold)."""

from typing import Any


def build_preprocessor(schema_config: dict[str, Any]) -> Any:
    """Build the scikit-learn ColumnTransformer once feature mappings are finalized."""
    raise NotImplementedError(
        "Feature preprocessing is scaffolded in Phase 1 and pending verified CSV headers."
    )

