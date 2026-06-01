
import numpy as np
import pandas as pd
from asreview.extensions import load_extension
from asreview.models.stoppers import StatisticalBuscarpy


def test_buscar_import():
    s = load_extension("models.stoppers", "statistical_buscarpy")(bias=1.0)
    assert s.name == "statistical_buscarpy"
    assert s.get_params()["bias"] == 1.0

def test_buscar_warmup_gate():
    s = StatisticalBuscarpy()
    assert s.stop(pd.DataFrame({"label": [1] * 10}), list(range(1000))) is False


def test_buscar_no_relevant_gate():
    s = StatisticalBuscarpy()
    assert s.stop(pd.DataFrame({"label": [0] * 200}), list(range(1000))) is False


def test_buscar_evaluation_interval_gate():

    s = StatisticalBuscarpy()
    assert s.stop(pd.DataFrame({"label": [1] * 201}), list(range(1000))) is False


def test_buscar_stop_trigger():

    rng = np.random.default_rng(42)
    N = 1000
    labels = np.zeros(N, dtype=int)
    labels[rng.choice(150, size=30, replace=False)] = 1

    s = StatisticalBuscarpy()
    stopped_at = None
    for i in range(s.eval_every, N + 1, s.eval_every):
        ev = s.evaluate(pd.DataFrame({"label": labels[:i]}), list(range(N)))
        if ev["should_stop"]:
            stopped_at = i
            break

    assert stopped_at is not None
    assert 800 <= stopped_at <= 900


def test_buscar_bias_direction():
    rng = np.random.default_rng(42)
    N = 1000
    labels = np.zeros(N, dtype=int)
    labels[rng.choice(150, size=30, replace=False)] = 1
    df = pd.DataFrame({"label": labels[:500]})

    p1 = StatisticalBuscarpy(bias=1.0).evaluate(df, list(range(N)))["p"]
    p5 = StatisticalBuscarpy(bias=5.0).evaluate(df, list(range(N)))["p"]
    assert p5 < p1