"""Build a fitted preprocessing and regression pipeline that the API can load."""

import pandas as pd
from sklearn.base import RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import OneHotEncoder

CATEGORICAL_FEATURES = frozenset({"Type_of_order", "Festival", "City"})


def build_training_pipeline(features: list[str], regressor: RegressorMixin) -> Pipeline:
    """Apply the same transformations in training and for every incoming order."""
    categorical = [column for column in features if column in CATEGORICAL_FEATURES]
    numeric = [column for column in features if column not in CATEGORICAL_FEATURES]
    categories = make_pipeline(
        SimpleImputer(missing_values=pd.NA, strategy="constant", fill_value="unknown"),
        OneHotEncoder(handle_unknown="ignore", sparse_output=False),
    )
    preprocessing = ColumnTransformer(
        [("numeric", SimpleImputer(strategy="median"), numeric), ("categorical", categories, categorical)]
    )
    return make_pipeline(preprocessing, regressor)

