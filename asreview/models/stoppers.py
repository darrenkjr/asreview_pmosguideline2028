# Copyright 2019-2025 The ASReview Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Stopper mechanisms for the review process.

The stopper mechanisms determine when the review process should be stopped.
This can be based on the properties of the results table or the input dataset.


.. warning::
    This module is experimental and might change.

"""

import pandas as pd

from sklearn.base import BaseEstimator

__all__ = [
    "LastRelevant",
    "NLabeled",
    "QuantileLabeled",
    "IsFittable",
    "NConsecutiveIrrelevant",
    "StatisticalBuscarpy"
]


def safe_stop(stop_method):
    """Decorator to ensure safe stopping conditions."""

    def wrapper(self, results, data):
        if len(data) == 0:
            return True
        if len(results) == len(data):
            return True
        return stop_method(self, results, data)

    return wrapper


def raise_if_not_simulate(stop_method):
    """Decorator to only use the stopping mechanism in simulation."""

    def wrapper(self, results, data):
        if isinstance(data, (pd.DataFrame, pd.Series)):
            data_check = data
        else:
            data_check = pd.Series(data)

        if data_check.isna().any():
            raise ValueError("Stopper mechanism requires all data to be labeled.")

        return stop_method(self, results, data)

    return wrapper


class LastRelevant(BaseEstimator):
    """Stop after last relevant record.

    The stopping mechanism stops the review when all records have been
    labeled.

    Arguments
    ---------
    value: int, str
        Number of labels to stop the review at. If set to "min", the review will
        stop when all relevant records are found.
    """

    name = "last_relevant"
    label = "Last Relevant"

    @safe_stop
    @raise_if_not_simulate
    def stop(self, results, data):
        """Check if the review should be stopped.

        This function checks if the review should be stopped based on the results
        and the labels of the papers.

        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review.
        data: pandas.DataFrame, list, np.array
            pandas.DataFrame, list, np.array with all records. Used to determine
            number of all records in data.

        Returns
        -------
        bool:
            True if the review should be stopped, False otherwise.
        """

        if sum(data) == sum(results["label"]):
            return True

        return False


class NLabeled(BaseEstimator):
    """Stop the review after n have been labeled.

    Arguments
    ---------
    n: int, tuple
        Number of labels to stop the review at. If tuple, the first element is
        the number of relevant records to find, the second element is the number
        of irrelevant records to find.
    """

    name = "n_labeled"
    label = "N Labeled"

    def __init__(self, n):
        self.n = n

    @safe_stop
    def stop(self, results, data):
        """Check if the review should be stopped.

        This function checks if the review should be stopped based on the results
        and the labels of the papers.

        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review.
        data: pandas.DataFrame, list, np.array
            pandas.DataFrame, list, np.array with all records. Used to determine
            number of all records in data.

        Returns
        -------
        bool:
            True if the review should be stopped, False otherwise.
        """

        if not isinstance(self.n, (int, tuple)):
            raise ValueError("StopperN requires an integer or a tuple of integers")

        if self.n == -1:
            return False

        if isinstance(self.n, int) and len(results) >= self.n:
            return True

        if isinstance(self.n, tuple):
            n_relevant, n_irrelevant = self.n
            if (
                sum(results["label"] == 1) >= n_relevant
                and sum(results["label"] == 0) >= n_irrelevant
            ):
                return True

        return False


class QuantileLabeled(BaseEstimator):
    """Stop the review after a certain quantile of the records have been labeled.

    Arguments
    ---------
    quantile: float
        Quantile of records to label before stopping the review.
    """

    name = "q_labeled"
    label = "Quantile Labeled"

    def __init__(self, quantile):
        self.quantile = quantile

    @safe_stop
    def stop(self, results, data):
        """Check if the review should be stopped.

        This function checks if the review should be stopped based on the results
        and the labels of the papers.

        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review.
        data: pandas.DataFrame, list, np.array
            pandas.DataFrame, list, np.array with all records. Used to determine
            number of all records in data.

        Returns
        -------
        bool:
            True if the review should be stopped, False otherwise.
        """

        # Stop when reaching quantile (if provided)
        if len(results) / len(data) >= self.quantile:
            return True

        return False


class IsFittable(NLabeled):
    """Stop the review after both classes are found."""

    name = "is_fittable"
    label = "Is Fittable"

    def __init__(self):
        super().__init__(n=(1, 1))


class NConsecutiveIrrelevant(BaseEstimator):
    """Stop the review after n irrelevant records have been labeled in a row.

    Arguments
    ---------
    n: int
        Number of irrelevant records in a row to stop the review at.
    """

    name = "n_consecutive_irrelevant"
    label = "N Consecutive Irrelevant"

    def __init__(self, n):
        self.n = n

    @safe_stop
    def stop(self, results, data):
        """Check if the review cycle should be stopped.

        This function checks if the review cycle should be stopped based on the results
        and the labels of the papers.

        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review.
        data: pandas.DataFrame, list, np.array
            pandas.DataFrame, list, np.array with all records. Used to determine
            number of all records in data.

        Returns
        -------
        bool:
            True if the review should be stopped, False otherwise.
        """

        if len(results) > self.n and sum(results["label"].iloc[-self.n :]) == 0:
            return True

        return False

class StatisticalBuscarpy(BaseEstimator): 
    """Statistical stopping criterion based on hypothesis test based on hypergeometric distribution as proposed by   
    Callaghan et al. (2020). Uses the implementation in the buscarpy python package. 
    
    Models screening as sampling without replacement and tests the null hypothesis that the recall target has not yet been
    achieved up to a certain confidence level. Stops when p-value falls below certain confidence threshold. 

    Arguments 
    ---
    recall_target: float
        Target recall / sensitivity rate. 
        Default : 0.95

    confidence_level: float
        Confidence threshold for when to suggest to stop screening 
        Default: 0.95

    bias: float 
        How much more likely a relevant record is to be sample than an irrelevant one. 
        1.0 Indicates most conservative assumption, where each article is being sampled in random order. Bias >1.0 implies 
        that relevant records are more likely to be sampled than irrelevant records (e.g. relevant records appear earlier in
        the list) due to AI ordering. 
        Default: 1.0 
        
    eval_every: int
        Number of records in an interval to screen before evaluating whether to stop. 
        Default: 10

    warmup: int 
        Number of records that need to be screened before evaluation begins 
        Default: 20
    """
    name = "statistical_buscarpy"
    label = "Statistical Buscarpy"
    
    def __init__(
        self, 
        recall_target = 0.95, 
        confidence_level = 0.95, 
        bias = 1.0, 
        eval_every = 10, 
        warmup = 20
    ):

        self.recall_target = recall_target
        self.confidence_level = confidence_level
        self.bias = bias
        self.eval_every = eval_every
        self.warmup = warmup

    def evaluate(self, results, data): 
        """Return p value from buscarpy based on current screening process
        
        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review, including a "label"
            column ordered by screening time.
        data: pandas.DataFrame, list, np.array
            All records. Used to determine the total number of records N.

        Returns
        -------
        dict:
            Dictionary with the results of the evaluation, including "p" 
            (p-value), "should_stop" (boolean), and "reason" (string).
        """
        
        import buscarpy

        n_screened = len(results)
        n_total = len(data)

        assert n_total != 0
        assert n_screened < n_total

        if n_screened < self.warmup:
            return {"p": None, "should_stop": False, "reason": "warmup"}
        if int(results["label"].sum()) == 0:
            return {"p": None, "should_stop": False, "reason": "no_relevant_yet"}

        labels = results["label"].astype(int).to_numpy()
        p = buscarpy.calculate_h0(
            labels_=labels,
            N=int(n_total),
            recall_target=self.recall_target,
            bias=self.bias,
        )
        alpha = 1.0 - self.confidence_level
        return {
            "p": None if p is None else float(p),
            "should_stop": p is not None and p < alpha,
            "reason": "evaluated",
        }      
    
    @safe_stop
    def stop(self, results, data): 
        """Check if current review cycle should be stopped. 

        Arguments
        ---------
        results: pandas.DataFrame
            DataFrame with the results of the review, including a "label"
            column ordered by screening time.
        data: pandas.DataFrame, list, np.array
            All records. Used to determine the total number of records N.

        Returns
        -------
        bool:
            True if the review should be stopped, False otherwise.
        """
        n_screened = len(results)
        if n_screened < self.warmup or (n_screened % self.eval_every) != 0:
            return False
        return self.evaluate(results, data)["should_stop"]

        

    
