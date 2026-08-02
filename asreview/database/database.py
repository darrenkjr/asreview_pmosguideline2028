import json
import sqlite3
import time
from functools import cached_property

import pandas as pd

from asreview.data.record import Record
from asreview.database.store import DataStore
from asreview.database.store import _build_conn_uri

__all__ = ["Database"]

CURRENT_DATABASE_VERSION = 4

MODEL_COLUMNS = [
    "classifier",
    "querier",
    "balancer",
    "feature_extractor",
    "training_set",
]

REQUIRED_TABLES = [
    "results",
    "last_ranking",
    "decision_changes",
    "skipped_records",
    "record_notes",
]

RESULTS_TABLE_COLUMNS_PANDAS_DTYPES = {
    "record_id": "Int64",
    "label": "Int64",
    "classifier": "object",
    "querier": "object",
    "balancer": "object",
    "feature_extractor": "object",
    "training_set": "Int64",
    "time": "Float64",
    "note": "object",
    "tags": "object",
    "user_id": "Int64",
    "duration_user_attribution": "Int64",
    "duration_raw": "Float64",
    "duration_away": "Float64",
}

RANKING_TABLE_COLUMNS_PANDAS_DTYPES = {
    "record_id": "Int64",
    "ranking": "Int64",
    "classifier": "object",
    "querier": "object",
    "balancer": "object",
    "feature_extractor": "object",
    "training_set": "Int64",
    "time": "Float64",
}


def open_db(fp, read_only=False):
    """Open a database.

    Parameters
    ----------
    fp : path-like
        File path to the database
    read_only : bool, optional
        Whether to create a new database if one doesn't exist yet and whether the opened
        database will be in read only mode or not.

    Returns
    -------
    Database
        ASReview database.

    Raises
    ------
    FileNotFoundError
        If `read_only` and there is no file at `fp`.
    ValueError
        If `read_only` and there is no valid database at `fp`.
    """
    if not fp.is_file():
        if read_only:
            raise FileNotFoundError(
                f"File path {fp} is not a file and 'read_only' is 'True'"
            )
        fp.parent.mkdir(parents=True, exist_ok=True)

    db = Database(fp, read_only=read_only)
    try:
        db._is_valid()
    except ValueError as e:
        if read_only:
            raise ValueError(
                f"There is no valid database at {fp} and the database is opened in"
                " read-only mode"
            ) from e
        db.create_tables()
    return db


class Database:
    """Database containing the input data and results.

    Database contains two parts: the input and the results. For more information on the
    input, see `asreview.database.store.py`. For more information on the results, see
    `asreview.database.sqlstate.py`.

    Attributes
    ----------
    user_version: str
        Return the version number of the database.
    """

    def __init__(self, fp=":memory:", record_cls=Record, read_only=False):
        """Initialize the Database.

        Parameters
        ----------
        fp : str | Path
            Path of the database file. Use `":memory:"` for an in-memory database.
        record_cls : type[asreview.data.record.Base], optional
            Type to use for the input records, see `DataStore` for more information.
        read_only : bool, optional
            Whether to open the database in read only mode. If the database is opened in
            read only mode and an attempt to write to the database is made, an
            `sqlite3.OperationalError` will be raised.
        """
        if fp == ":memory:" and read_only:
            raise ValueError("Can't open an in-memory database in read only mode")

        self.fp = fp
        self.record_cls = record_cls
        self.read_only = read_only
        self._in_memory = fp == ":memory:"
        self._closed = False
        self._conn_uri = _build_conn_uri(fp, read_only)

        self.input = DataStore(
            conn_uri=self._conn_uri, record_cls=record_cls, read_only=read_only
        )

        if self._in_memory:
            # Eagerly open the sqlite3 connection. For named in-memory databases,
            # the database is destroyed when the last connection to it closes.
            # This connection acts as an anchor that keeps the database alive
            # for the lifetime of this object.
            self._conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        self.close()

    @cached_property
    def _conn(self):
        """Get a connection to the SQLite database.

        Returns
        -------
        sqlite3.Connection
            Connection to the SQLite database.
        """
        return sqlite3.connect(self._conn_uri, uri=True)

    def close(self):
        """Close the database and release all resources.

        For in-memory databases this will destroy the database. Safe to call multiple
        times.
        """
        if self._closed:
            return
        self._closed = True
        self.input.engine.dispose()
        if "_conn" in self.__dict__:
            self._conn.close()
            del self.__dict__["_conn"]

    @property
    def user_version(self):
        """Version number of the state."""
        cur = self._conn.cursor()
        version = cur.execute("PRAGMA user_version")

        return int(version.fetchone()[0])

    @user_version.setter
    def user_version(self, version):
        cur = self._conn.cursor()
        cur.execute(f"PRAGMA user_version = {version}")
        self._conn.commit()
        cur.close()

    def create_tables(self):
        self.user_version = CURRENT_DATABASE_VERSION
        self.input.create_tables()

        cur = self._conn.cursor()

        cur.execute(
            """CREATE TABLE results
                            (record_id INTEGER UNIQUE,
                            label INTEGER,
                            classifier TEXT,
                            querier TEXT,
                            balancer TEXT,
                            feature_extractor TEXT,
                            training_set INTEGER,
                            time FLOAT,
                            note TEXT,
                            tags JSON,
                            user_id INTEGER,
                            duration_user_attribution INTEGER,
                            duration_raw FLOAT,
                            duration_away FLOAT)"""
        )

        cur.execute(
            """CREATE TABLE last_ranking
                            (record_id INTEGER UNIQUE,
                            ranking INT,
                            classifier TEXT,
                            querier TEXT,
                            balancer TEXT,
                            feature_extractor TEXT,
                            training_set INTEGER,
                            time FLOAT)"""
        )

        cur.execute(
            """CREATE TABLE IF NOT EXISTS decision_changes
                            (record_id INTEGER,
                            label INTEGER,
                            time FLOAT,
                            user_id INTEGER)"""
        )

        cur.execute(
            """CREATE TABLE IF NOT EXISTS skipped_records
                            (record_id INTEGER,
                            user_id INTEGER,
                            time FLOAT,
                            duration_raw FLOAT,
                            duration_away FLOAT)"""
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_skipped_records_record_id ON skipped_records(record_id)"
        )
        cur.execute(
            """CREATE TABLE IF NOT EXISTS record_notes
                            (id INTEGER PRIMARY KEY AUTOINCREMENT,
                            record_id INTEGER NOT NULL,
                            user_id INTEGER,
                            note TEXT NOT NULL,
                            created_at FLOAT NOT NULL,
                            edited_at FLOAT)"""
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_record_notes_record_id ON record_notes(record_id)"
        )

        self._conn.commit()

        self._set_results_changes_triggers()

    def _is_valid(self):
        cur = self._conn.cursor()
        if not self.read_only:
            self._fix_decision_changes_schema(cur)
            self._migrate_notes_and_rename_tables(cur)
            self._ensure_skipped_records_table(cur)
            self._ensure_record_notes_table(cur)
            self._migrate_duration_columns(cur)

        if self.user_version != CURRENT_DATABASE_VERSION:
            raise ValueError(
                f"Database version {self.user_version} is not supported. "
                "See migration guide."
            )

        table_names = cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table';"
        ).fetchall()

        table_names = [tup[0] for tup in table_names]
        missing_tables = [
            table
            for table in REQUIRED_TABLES + [self.record_table_name]
            if table not in table_names
        ]
        if missing_tables:
            raise ValueError(
                f"The SQL file should contain tables named "
                f"'{' '.join(missing_tables)}'."
            )

        column_names = cur.execute("PRAGMA table_info(results)").fetchall()
        column_names = [tup[1] for tup in column_names]
        missing_columns = [
            col
            for col in RESULTS_TABLE_COLUMNS_PANDAS_DTYPES.keys()
            if col not in column_names
        ]
        if missing_columns:
            raise ValueError(
                f"The results table does not contain the columns "
                f"{' '.join(missing_columns)}."
            )

    def _ensure_skipped_records_table(self, cur):
        """Ensure the skipped_records table and index exist."""
        cur.execute(
            """CREATE TABLE IF NOT EXISTS skipped_records
                            (record_id INTEGER,
                            user_id INTEGER,
                            time FLOAT,
                            duration_raw FLOAT,
                            duration_away FLOAT)"""
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_skipped_records_record_id ON skipped_records(record_id)"
        )
        self._conn.commit()

    def _ensure_record_notes_table(self, cur):
        """Ensure the record_notes table and index exist."""
        cur.execute(
            """CREATE TABLE IF NOT EXISTS record_notes
                            (id INTEGER PRIMARY KEY AUTOINCREMENT,
                            record_id INTEGER NOT NULL,
                            user_id INTEGER,
                            note TEXT NOT NULL,
                            created_at FLOAT NOT NULL,
                            edited_at FLOAT)"""
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_record_notes_record_id ON record_notes(record_id)"
        )
        self._conn.commit()

    def _migrate_notes_and_rename_tables(self, cur):
        """Migrate legacy notes to record_notes and rename skipped_notes to skipped_records."""
        if self.user_version >= 4:
            return
        if not cur.execute("PRAGMA table_info(results)").fetchall():
            return None

        with self._conn:
            self._ensure_record_notes_table(cur)
            table_names = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]

            if "skipped_notes" in table_names:
                # Copy legacy skip notes into record_notes
                cur.execute(
                    """INSERT INTO record_notes (record_id, user_id, note, created_at, edited_at)
                    SELECT record_id, user_id, note, time, NULL
                    FROM skipped_notes
                    WHERE note IS NOT NULL AND TRIM(note) != ''"""
                )
                if "skipped_records" not in table_names:
                    cur.execute("ALTER TABLE skipped_notes RENAME TO skipped_records")
                
                # Ensure skipped_records has note column dropped
                skipped_cols = [r[1] for r in cur.execute("PRAGMA table_info(skipped_records)").fetchall()]
                if "note" in skipped_cols:
                    try:
                        cur.execute("ALTER TABLE skipped_records DROP COLUMN note")
                    except sqlite3.OperationalError:
                        cur.execute("""CREATE TABLE skipped_records_new
                            (record_id INTEGER, user_id INTEGER, time FLOAT, duration_raw FLOAT, duration_away FLOAT)""")
                        cur.execute("""INSERT INTO skipped_records_new
                            SELECT record_id, user_id, time, duration_raw, duration_away FROM skipped_records""")
                        cur.execute("DROP TABLE skipped_records")
                        cur.execute("ALTER TABLE skipped_records_new RENAME TO skipped_records")
                        cur.execute("CREATE INDEX IF NOT EXISTS idx_skipped_records_record_id ON skipped_records(record_id)")
            else:
                self._ensure_skipped_records_table(cur)

            # Copy legacy label notes from results into record_notes
            cur.execute(
                """INSERT INTO record_notes (record_id, user_id, note, created_at, edited_at)
                SELECT record_id, user_id, note, time, NULL
                FROM results
                WHERE note IS NOT NULL AND TRIM(note) != ''"""
            )

            cur.execute("PRAGMA user_version = 4")

    def _migrate_duration_columns(self, cur):
        """Add duration_user_attribution, duration_raw and duration_away columns if absent."""
        existing_cols = [
            row[1] for row in cur.execute("PRAGMA table_info(results)")
        ]

        if not existing_cols: 
            return None 


        if "duration_user_attribution" not in existing_cols:
            try:
                cur.execute("ALTER TABLE results ADD COLUMN duration_user_attribution INTEGER")
                cur.execute("UPDATE results SET duration_user_attribution = user_id WHERE duration_user_attribution IS NULL AND user_id IS NOT NULL")
            except sqlite3.OperationalError as e:
                if (
                    "duplicate column name" not in str(e).lower()
                    and "already exists" not in str(e).lower()
                ):
                    raise

        for table in ["results", "skipped_records"]:
            existing_cols = [
                row[1] for row in cur.execute(f"PRAGMA table_info({table})")
            ]
            for col in ["duration_raw", "duration_away"]:
                if col not in existing_cols:
                    try:
                        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} FLOAT")
                    except sqlite3.OperationalError as e:
                        if (
                            "duplicate column name" not in str(e).lower()
                            and "already exists" not in str(e).lower()
                        ):
                            raise
        self._conn.commit()

    def _fix_decision_changes_schema(self, cur):
        """Fix decision_changes schema for projects migrated from old v2 format.

        Old v2 projects had (record_id, new_label, time) instead of
        (record_id, label, time, user_id). Projects already migrated to v3
        may still carry the old schema.
        """
        columns = [row[1] for row in cur.execute("PRAGMA table_info(decision_changes)")]
        if not columns: 
            return None

        if "new_label" in columns and "label" not in columns:
            cur.execute("ALTER TABLE decision_changes RENAME COLUMN new_label TO label")

        if "user_id" not in columns:
            cur.execute("ALTER TABLE decision_changes ADD COLUMN user_id INTEGER")

        self._conn.commit()

    def _set_results_changes_triggers(self):
        con = self._conn
        cur = con.cursor()
        cur.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_results_delete
            AFTER DELETE ON results
            FOR EACH ROW
            BEGIN
                INSERT INTO decision_changes (record_id, label, time, user_id)
                VALUES (OLD.record_id, OLD.label, OLD.time, OLD.user_id);
            END
        """)
        cur.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_results_label_update
            AFTER UPDATE OF label ON results
            FOR EACH ROW
            WHEN OLD.label IS NOT NEW.label
            BEGIN
                INSERT INTO decision_changes (record_id, label, time, user_id)
                VALUES (OLD.record_id, OLD.label, OLD.time, OLD.user_id);
            END
        """)
        con.commit()

    @property
    def record_table_name(self):
        return self.input.record_cls.__tablename__

    @property
    def exist_new_labeled_records(self):
        """Return True if there are new labeled records.

        Return True if there are any record labels added since the last time
        the model ranking was added to the state. Also returns True if no
        model was trained yet, but priors have been added.
        """
        labeled = self.get_results_table("label")
        last_training_set = self.get_last_ranking_table()["training_set"]

        if last_training_set.empty or pd.isna(last_training_set.max()):
            return len(labeled) > 0
        else:
            return len(labeled) > last_training_set.max()

    def _replace_results_from_df(self, results):
        if not set(results.columns) == set(RESULTS_TABLE_COLUMNS_PANDAS_DTYPES):
            raise ValueError(
                f"Columns of the results dataframe should be "
                f"{list(RESULTS_TABLE_COLUMNS_PANDAS_DTYPES.keys())}."
            )

        cur = self._conn.cursor()
        cur.execute("delete from results")
        self._conn.commit()
        cur.close()

        results.to_sql("results", self._conn, if_exists="append", index=False)

    def _replace_last_ranking_from_df(self, last_ranking):
        if not set(last_ranking.columns) == set(RANKING_TABLE_COLUMNS_PANDAS_DTYPES):
            raise ValueError(
                f"Columns of the last ranking dataframe should be "
                f"{list(RANKING_TABLE_COLUMNS_PANDAS_DTYPES.keys())}."
            )

        last_ranking.to_sql(
            "last_ranking", self._conn, if_exists="replace", index=False
        )

    def add_last_ranking(
        self,
        ranked_record_ids,
        classifier,
        querier,
        balancer,
        feature_extractor,
        training_set=None,
    ):
        """Save the ranking of the last iteration of the model.

        Save the ranking of the last iteration of the model, in the ranking
        order, so the record on row 0 is ranked first by the model.

        Parameters
        ----------
        ranked_record_ids: list, numpy.ndarray
            A list of records ids in the order that they were ranked.
        classifier: str
            Name of the classifier of the model.
        querier: str
            Name of the query strategy of the model.
        balancer: str
            Name of the balance strategy of the model.
        feature_extractor: str
            Name of the feature extraction method of the model.
        training_set: int
            Number of labeled records available at the time of training.
        """

        pd.DataFrame(
            {
                "record_id": ranked_record_ids,
                "ranking": range(len(ranked_record_ids)),
                "classifier": classifier,
                "querier": querier,
                "balancer": balancer,
                "feature_extractor": feature_extractor,
                "training_set": training_set,
                "time": time.time(),
            }
        ).to_sql("last_ranking", self._conn, if_exists="replace", index=False)

    def get_last_ranking_table(self):
        """Get the ranking from the state.

        Returns
        -------
        pd.DataFrame
            Dataframe with columns 'record_id', 'ranking', 'classifier',
            'querier', 'balancer', 'feature_extractor',
            'training_set' and 'time'. It has one row for each record in the
            dataset, and is ordered by ranking.
        """
        return pd.read_sql_query(
            "SELECT * FROM last_ranking",
            self._conn,
            dtype=RANKING_TABLE_COLUMNS_PANDAS_DTYPES,
        )

    def label_record(
        self,
        record_id,
        label,
        tags=None,
        user_id=None,
        duration_raw=None,
        duration_away=None,
    ):
        if tags is not None:
            tags = json.dumps(tags)
        labeling_time = time.time()
        con = self._conn
        cur = con.cursor()
        model_string = ", ".join(MODEL_COLUMNS)
        target_result_string = ", ".join(
            f"target_result.{col}" for col in MODEL_COLUMNS
        )
        upsert_columns = ["label", "time", "tags", "user_id"] + MODEL_COLUMNS
        upsert_string = ", ".join(f"{col} = excluded.{col}" for col in upsert_columns)

        cur.execute(
            f"""
            WITH target_group AS (
                SELECT record_id
                FROM {self.record_table_name}
                WHERE group_id = (
                    SELECT group_id
                    FROM {self.record_table_name}
                    WHERE record_id=:record_id
                )
            ), target_result AS (
                SELECT {model_string}
                FROM results
                WHERE record_id = :record_id
            )
            INSERT INTO results(record_id, label, time, tags, user_id, duration_user_attribution, duration_raw, duration_away, {model_string})
            SELECT target_group.record_id, :label, :time, :tags, :user_id, :user_id, :duration_raw, :duration_away, {target_result_string}
            FROM target_group
            LEFT JOIN target_result ON 1
            ON CONFLICT(record_id) DO UPDATE
                SET {upsert_string},
                    duration_user_attribution = COALESCE(results.duration_user_attribution, excluded.duration_user_attribution),
                    duration_raw = COALESCE(results.duration_raw, excluded.duration_raw),
                    duration_away = COALESCE(results.duration_away, excluded.duration_away);
            """,
            {
                "record_id": record_id,
                "label": label,
                "time": labeling_time,
                "tags": tags,
                "user_id": user_id,
                "duration_raw": duration_raw,
                "duration_away": duration_away,
            },
        )
        con.commit()

    def query_top_ranked(self, user_id=None):
        model_string = ", ".join(MODEL_COLUMNS)
        top_record_string = ", ".join(f"top_record.{col}" for col in MODEL_COLUMNS)
        con = self._conn
        cur = con.cursor()
        cur.execute(
            f"""INSERT INTO results (record_id, user_id, {model_string})
            WITH top_record AS (
                SELECT last_ranking.*
                FROM last_ranking
                LEFT JOIN results USING (record_id)
                WHERE results.record_id IS NULL
                ORDER BY ranking
                LIMIT 1
            ), group_records AS (
                SELECT record.record_id
                FROM record
                WHERE group_id = (
                    SELECT group_id
                    FROM record
                    WHERE record.record_id = (SELECT record_id FROM top_record)
                )
            )
            SELECT group_records.record_id, :user_id, {top_record_string}
            FROM group_records
            CROSS JOIN top_record;""",
            {"user_id": user_id},
        )
        con.commit()
        if not cur.rowcount:
            raise ValueError("Failed to query top ranked record")
        return self.get_pending(user_id=user_id)

    def update_result(self, record_id, label=None, tags=None, user_id=None):
        if label is None and tags is None:
            raise ValueError("At least one of 'label' or 'tags' must be provided.")

        fields = []
        values = {"record_id": record_id}
        if label is not None:
            fields.append("label = :label")
            values["label"] = label
            if user_id is not None:
                # We only update the user_id if the label changes.
                fields.append("user_id = :user_id")
                values["user_id"] = user_id
        if tags is not None:
            fields.append("tags = :tags")
            values["tags"] = json.dumps(tags)
        set_string = ", ".join(fields)

        con = self._conn
        cur = con.cursor()
        cur.execute(
            f"""
            WITH target_group AS (
                SELECT record_id
                FROM {self.record_table_name}
                WHERE group_id = (
                    SELECT group_id
                    FROM {self.record_table_name}
                    WHERE record_id=:record_id
                )
            )
            UPDATE results
            SET {set_string}
            WHERE record_id IN (SELECT record_id FROM target_group)
            """,
            values,
        )
        con.commit()



    def delete_result(self, record_id):
        con = self._conn
        cur = con.cursor()
        cur.execute(
            f"""
            WITH target_group AS (
                SELECT record_id
                FROM {self.record_table_name}
                WHERE group_id = (
                    SELECT group_id
                    FROM {self.record_table_name}
                    WHERE record_id=:record_id
                )
            )
            DELETE FROM results
            WHERE record_id IN (SELECT record_id FROM target_group)
            """,
            {"record_id": record_id},
        )
        con.commit()

    def get_results_record(self, record_id):
        """Get the data of a specific query from the results table.

        Parameters
        ----------
        record_id: int
            Record id of which you want the data.

        Returns
        -------
        pd.DataFrame
            Dataframe containing the data from the results table with the given
            record_id and columns.
        """

        result = pd.read_sql_query(
            f"SELECT * FROM results WHERE record_id={record_id}",
            self._conn,
            dtype=RESULTS_TABLE_COLUMNS_PANDAS_DTYPES,
        )
        result["tags"] = result["tags"].map(json.loads, na_action="ignore")
        return result

    def get_results_table(self, columns=None, priors=True, pending=False, groups=False):
        """Get a subset from the results table.

        Can be used to get any column subset from the results table.
        Most other get functions use this one, except some that use a direct
        SQL query for efficiency.

        Parameters
        ----------
        columns: list, str
            List of columns names of the results table, or a string containing
            one column name.
        priors: bool
            Whether to keep the records containing the prior knowledge.
        pending: bool
            Whether to keep the records which are pending a labeling decision.
        groups: bool
            Return all the records of a group of records. Be default only returns the
            base record of each group.

        Returns
        -------
        pd.DataFrame:
            Dataframe containing the data of the specified columns of the
            results table.
        """
        if isinstance(columns, str):
            columns = [columns]

        if (not priors) or (not pending) or (not groups):
            sql_where = []
            if not priors:
                sql_where.append("querier is not NULL")
            if not pending:
                sql_where.append("label is not NULL")
            if not groups:
                sql_where.append(
                    f"record_id IN ( SELECT group_id FROM {self.record_table_name})"
                )
            sql_where_str = "WHERE " + " AND ".join(sql_where)
        else:
            sql_where_str = ""

        if columns is None:
            col_dtype = RESULTS_TABLE_COLUMNS_PANDAS_DTYPES
        else:
            col_dtype = {
                k: v
                for k, v in RESULTS_TABLE_COLUMNS_PANDAS_DTYPES.items()
                if columns and k in columns
            }

        query_string = "*" if columns is None else ",".join(columns)
        df_results = pd.read_sql_query(
            f"SELECT {query_string} FROM results {sql_where_str} ORDER BY rowid",
            self._conn,
            dtype=col_dtype,
        )

        if columns is None or "tags" in columns:
            df_results["tags"] = df_results["tags"].map(json.loads, na_action="ignore")
        return df_results

    def get_priors(self):
        """Get the record ids of the priors.

        Returns
        -------
        pd.DataFrame:
            The result records of the priors in the order they were added. If multiple
            records are in the same group, only the base record of the group is
            returned.
        """
        df_results = pd.read_sql_query(
            f"""
            SELECT * FROM results
            WHERE results.querier is NULL
            AND results.label is not NULL
            AND record_id IN (
                SELECT group_id FROM {self.record_table_name}
            )
            ORDER BY rowid
            """,
            self._conn,
            dtype=RESULTS_TABLE_COLUMNS_PANDAS_DTYPES,
        )
        df_results["tags"] = df_results["tags"].map(json.loads, na_action="ignore")
        return df_results

    def get_pool(self):
        """Get the unlabeled, not-pending records in ranking order.

        Returns
        -------
        pd.Series
            Series containing the record_ids of the unlabeled, not pending
            records, in the order of the last available ranking. If the state does not
            yet contain a last ranking, the return value will be an empty dataframe. If
            multiple records are in the same group, only the base record of the group is
            returned.
        """

        return pd.read_sql_query(
            f"""SELECT record_id, last_ranking.ranking
                FROM last_ranking
                LEFT JOIN results
                USING (record_id)
                WHERE results.record_id is null AND last_ranking.record_id IN (
                    SELECT group_id FROM {self.record_table_name}
                )
                ORDER BY ranking
                """,
            self._conn,
        )["record_id"]

    def get_unlabeled(self, groups=False):
        """Get the unlabeled record ids in ranking order.

        Records that have no label or no entry in the results table are considered
        unlabeled.

        Parameters
        ----------
        groups : bool
            If True, return all records in each unlabeled group. If False,
            return only group representatives (record_id == group_id).

        Returns
        -------
        pd.Series
            Series of record_ids of unlabeled records ordered by ranking.
        """
        if groups:
            sql_group_filter = ""
        else:
            sql_group_filter = (
                f"AND record_id IN (SELECT group_id FROM {self.record_table_name})"
            )

        return pd.read_sql_query(
            f"""SELECT record_id, last_ranking.ranking
            FROM last_ranking
            JOIN {self.record_table_name} USING (record_id)
            LEFT JOIN results USING (record_id)
            WHERE (results.record_id IS NULL OR results.label IS NULL)
            {sql_group_filter}
            ORDER BY ranking
            """,
            self._conn,
        )["record_id"]

    def get_pending(self, user_id=None):
        """Get pending records from the results table.

        Parameters
        ----------
        user_id: int
            User id of the user who labeled the records.

        Returns
        -------
        pd.DataFrame
            DataFrame with pending results records.
        """
        query = f"""SELECT * FROM results WHERE label is null AND record_id IN (
            SELECT group_id FROM {self.record_table_name}
        )"""
        params = None
        if user_id is not None:
            query += " AND user_id=?"
            params = (user_id,)
        query += " ORDER BY rowid"

        return pd.read_sql_query(
            query,
            self._conn,
            params=params,
            dtype=RESULTS_TABLE_COLUMNS_PANDAS_DTYPES,
        )

    def get_decision_changes(self):
        """Get the record ids for any decision changes.

        Get the record ids of the records whose labels have been changed after the
        original labeling action.

        Returns
        -------
        pd.DataFrame
            Dataframe with columns 'record_id', 'label', 'time', and 'user_id' for each
            record of which the labeling decision was changed.
        """

        return pd.read_sql_query("SELECT * FROM decision_changes", self._conn)

    def skip_record(
        self,
        record_id,
        user_id=None,
        duration_raw=None,
        duration_away=None,
    ):
        con = self._conn
        cur = con.cursor()
        cur.execute(
            """INSERT INTO skipped_records
            (record_id, user_id, time, duration_raw, duration_away)
            VALUES (?, ?, ?, ?, ?)""",
            (record_id, user_id, time.time(), duration_raw, duration_away),
        )
        cur.execute("DELETE FROM results WHERE record_id = ?", (record_id,))
        cur.execute(
            """UPDATE last_ranking 
            SET ranking = (SELECT COALESCE(MAX(ranking), 0) + 1 FROM last_ranking) 
            WHERE record_id = ?""",
            (record_id,)
        )
        con.commit()

    def get_skipped_table(self, user_ids=None):
        """Get table of all skipped records with their latest skip state."""
        if user_ids:
            placeholders = ",".join("?" for _ in user_ids)
            query = f"""
                SELECT record_id, user_id, MAX(time) as time, NULL as label
                FROM skipped_records
                WHERE user_id IN ({placeholders})
                GROUP BY record_id
                HAVING record_id NOT IN (
                    SELECT record_id 
                    FROM results 
                    WHERE label IS NOT NULL
                )
                ORDER BY time ASC
            """
            return pd.read_sql_query(query, self._conn, params=user_ids)
        else:
            query = """
                SELECT record_id, user_id, MAX(time) as time, NULL as label
                FROM skipped_records
                GROUP BY record_id
                HAVING record_id NOT IN (
                    SELECT record_id 
                    FROM results 
                    WHERE label IS NOT NULL
                )
                ORDER BY time ASC
            """
            return pd.read_sql_query(query, self._conn)

    def add_record_note(self, record_id, user_id, note):
        """Add a new note row for a record."""
        con = self._conn
        cur = con.cursor()
        cur.execute(
            """INSERT INTO record_notes (record_id, user_id, note, created_at, edited_at)
            VALUES (?, ?, ?, ?, NULL)""",
            (record_id, user_id, note, time.time()),
        )
        con.commit()
        return cur.lastrowid

    def edit_record_note(self, note_id, user_id, note, auth_enabled=True):
        """Overwrite text and set edited_at for a specific note ID."""
        con = self._conn
        cur = con.cursor()
        if auth_enabled and user_id is not None:
            cur.execute(
                "UPDATE record_notes SET note = ?, edited_at = ? WHERE id = ? AND user_id = ?",
                (note, time.time(), note_id, user_id),
            )
        else:
            cur.execute(
                "UPDATE record_notes SET note = ?, edited_at = ? WHERE id = ?",
                (note, time.time(), note_id),
            )
        con.commit()
        return cur.rowcount > 0

    def delete_record_note(self, note_id, user_id=None, auth_enabled=True):
        """Hard delete a note by ID."""
        con = self._conn
        cur = con.cursor()
        if auth_enabled and user_id is not None:
            cur.execute(
                "DELETE FROM record_notes WHERE id = ? AND user_id = ?",
                (note_id, user_id),
            )
        else:
            cur.execute(
                "DELETE FROM record_notes WHERE id = ?",
                (note_id,),
            )
        con.commit()
        return cur.rowcount > 0

    def get_record_notes(self, record_ids):
        """Get notes for a single record_id or a list/collection of record_ids.

        If passed a single record_id (int/str), returns a list of notes ordered by created_at ASC.
        If passed a list/collection of record_ids, returns a dict mapping record_id -> list of notes.
        """
        is_single = isinstance(record_ids, (int, str)) or not hasattr(record_ids, "__iter__")
        ids = [int(record_ids)] if is_single else [int(i) for i in record_ids]

        if not ids:
            return [] if is_single else {}

        con = self._conn
        cur = con.cursor()
        placeholders = ",".join("?" for _ in ids)
        res = cur.execute(
            f"SELECT id, record_id, user_id, note, created_at, edited_at FROM record_notes WHERE record_id IN ({placeholders}) ORDER BY created_at ASC",
            ids,
        ).fetchall()

        notes_by_record = {}
        for r in res:
            notes_by_record.setdefault(r[1], []).append({
                "id": r[0],
                "record_id": r[1],
                "user_id": r[2],
                "note": r[3],
                "created_at": r[4],
                "edited_at": r[5],
            })

        if is_single:
            return notes_by_record.get(ids[0], [])
        return notes_by_record
