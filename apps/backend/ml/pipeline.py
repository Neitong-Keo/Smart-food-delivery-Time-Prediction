"""Build the shared feature transformations used for training and serving."""

import numpy as np
import pandas as pd
from sklearn.base import RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder

CATEGORICAL_FEATURES = frozenset({"Type_of_order", "Festival", "City"})


def _normalize_category_nulls(values: pd.DataFrame) -> pd.DataFrame:
    """Give object and nullable string columns a common missing-value marker."""
    return values.astype(object).where(values.notna(), np.nan)


def build_preprocessor(features: list[str]) -> ColumnTransformer:
    """Impute missing values and one-hot encode categories using fitted training data."""
    categorical = [column for column in features if column in CATEGORICAL_FEATURES]
    numeric = [column for column in features if column not in CATEGORICAL_FEATURES]
    categories = make_pipeline(
        FunctionTransformer(_normalize_category_nulls, feature_names_out="one-to-one"),
        SimpleImputer(strategy="constant", fill_value="unknown"),
        OneHotEncoder(handle_unknown="ignore", sparse_output=False),
    )
    return ColumnTransformer(
        [
            ("numeric", SimpleImputer(strategy="median", keep_empty_features=True), numeric),
            ("categorical", categories, categorical),
        ]
    )


def build_training_pipeline(features: list[str], regressor: RegressorMixin) -> Pipeline:
    """Apply the same transformations in training and for every incoming order."""
    return make_pipeline(build_preprocessor(features), regressor)

