import os

import pytest

import asreview as asr
from asreview.extensions import extensions
from asreview.extensions import load_extension

REQUIRES_AI_MODEL_DEP = ["doc2vec", "embedding-idf", "sbert"]


def test_feature():
    assert len(extensions("models.feature_extractors")) >= 2


@pytest.mark.parametrize("feature_extractor", extensions("models.feature_extractors"))
def test_feature_name(feature_extractor):
    model = load_extension("models.feature_extractors", feature_extractor.name)()
    assert model.name == feature_extractor.name


@pytest.mark.parametrize("feature_extractor", extensions("models.feature_extractors"))
def test_feature_extractor_param(feature_extractor):
    model = load_extension("models.feature_extractors", feature_extractor.name)()
    assert isinstance(model.get_params(), dict)


@pytest.mark.parametrize("feature_extractor", extensions("models.feature_extractors"))
def test_features(tmpdir, feature_extractor):
    data_fp = os.path.join("tests", "demo_data", "generic.csv")

    db = asr.load_dataset(data_fp, dataset_id="test_id")
    model = load_extension("models.feature_extractors", feature_extractor.name)()
    if model.name == "precomputed_embedding": 
        pass
    else: 
        X = model.fit_transform(db.input.get_df())
        assert X.shape[0] == len(db.input)
        assert X.shape[1] > 0


def test_precomputed_embedding():
    from asreview.models.feature_extractors import PrecomputedEmbedding
    model = PrecomputedEmbedding()
    assert model.name == "precomputed_embedding"
    assert isinstance(model.get_params(), dict)
    assert model.fit(None) is model
    with pytest.raises(NotImplementedError):
        model.transform(None)
