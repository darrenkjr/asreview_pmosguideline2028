import json
from pathlib import Path
from importlib.metadata import entry_points
from asreview import extensions


def read_tags_data(project):
    """Read tags data from the tags.json file."""
    tags_path = Path(project.project_path, "tags.json")
    try:
        with open(tags_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as err:
        raise RuntimeError(f"Failed to read tags data: {err}")


def add_id_to_tags(group):
    if "values" not in group:
        return group

    for i, _ in enumerate(group["values"]):
        if "id" in group["values"][i]:
            continue

        group["values"][i]["id"] = i

    return group


def get_dist_extensions_metadata():
    """Get all distributions with models."""
    entries = entry_points(group="asreview.models", name="_metadata")

    all_metadata = {}

    for e in entries:
        try:
            metadata = e.load()

            if not isinstance(metadata, dict):
                raise TypeError(
                    f"Metadata for {e.name} is not a dictionary: {type(metadata)}"
                )

            for key, value in metadata.items():
                if key in all_metadata and isinstance(all_metadata[key], dict):
                    all_metadata[key].update(value)
                else:
                    all_metadata[key] = value

        except Exception:
            continue

    return all_metadata


def get_all_model_components():
    model_components = {
        "balancers": [],
        "classifiers": [],
        "feature_extractors": [],
        "queriers": [],
    }

    entry_points_per_submodel = [
        extensions("models.balancers"),
        extensions("models.classifiers"),
        extensions("models.feature_extractors"),
        extensions("models.queriers"),
    ]

    metadata = get_dist_extensions_metadata()

    for entries, key in zip(entry_points_per_submodel, model_components.keys()):
        for e in entries:
            try:
                label = metadata[key][e.name]["label"]
            except KeyError:
                label = e.name
            except Exception as err:
                raise Exception(f"Failed to read metadata: {err}")

            model_components[key].append(
                {
                    "name": e.name,
                    "label": label,
                }
            )

    return model_components


def read_topic_rankings(project, record_data, preloaded_rankings=None):
    """Read precomputed topic rankings for a specific record."""
    record_id = None
    dataset_row = None

    if isinstance(record_data, dict):
        record_id = record_data.get("record_id")
        dataset_row = record_data.get("dataset_row")
    elif hasattr(record_data, "record_id"):
        record_id = getattr(record_data, "record_id")
        dataset_row = getattr(record_data, "dataset_row", None)
    else:
        record_id = record_data

    if record_id is None and dataset_row is None:
        return None

    if preloaded_rankings is None:
        rankings_path = Path(project.project_path, "precomputed_topic_rankings.json")
        try:
            with open(rankings_path, "r", encoding="utf-8") as f:
                ranking_data = json.load(f)
            all_rankings = ranking_data.get("rankings", {})
        except FileNotFoundError:
            return None
        except Exception as err:
            raise RuntimeError(f"Failed to read topic rankings: {err}")
    else:
        all_rankings = preloaded_rankings

    keys_to_try = []
    if record_id is not None:
        keys_to_try.extend([str(record_id), record_id])
        try:
            keys_to_try.extend([str(int(record_id) - 1), int(record_id) - 1])
        except (ValueError, TypeError):
            pass
    if dataset_row is not None:
        keys_to_try.extend([str(dataset_row), dataset_row])

    for k in keys_to_try:
        if k in all_rankings:
            return all_rankings[k]

    return None

def normalize_title(title):
    import re
    if not title:
        return ""
    return re.sub(r"\s+", " ", title.strip().lower())

def validate_uploaded_embeddings(project, feature_matrix, npz_data=None): 
    """Validate that uploaded embeddings align with the project database
    
    Checks:

    """
    
    num_records = len(project.db.input)
    num_rows = feature_matrix.shape[0]
    if num_rows != num_records:
        return False, (
            f"Row count mismatch. Matrix has {num_rows} rows, "
            f"but dataset has {num_records} records."
        )
 
    db_df = project.db.input.get_df().sort_values("record_id")
    if db_df["record_id"].tolist() != list(range(num_records)):
        return False, (
            "Record IDs are not contiguous from 0, so matrix rows cannot be "
            "matched to records by position. The dataset may have had records "
            "removed."
        )
    
    if npz_data is not None and 'titles' in npz_data:
        raw_up_titles = [
            v.decode("utf-8") if isinstance(v, bytes) else str(v)
            for v in npz_data["titles"]
        ]
        raw_db_titles = db_df["title"].fillna("").tolist()
        norm_up_titles = [normalize_title(t) for t in raw_up_titles]
        norm_db_titles = [normalize_title(t) for t in raw_db_titles]
        if all(norm_up_titles) and all(norm_db_titles):
            for i in range(num_rows): 
                if norm_up_titles[i] != norm_db_titles[i]:
                    return False, (
                        f"Title mismatch at record ID {i}. "
                        f"Uploaded title: '{raw_up_titles[i]}', "
                    f"Project DB title: '{raw_db_titles[i]}'."
                )
    return True, None



def validate_record_ranking_pairing(project, rankings):
    """Validate that uploaded rankings align with the project database.

    Checks:
    - Every record_id in rankings exists in the project DB
    - Titles (if provided) match between rankings and DB (normalized comparison)

    Returns:
        (True, None) if valid, or (False, error_message) if not.
    """
    # Build {record_id: title} from the project database
    db_records = project.db.input.get_df()
    db_titles = {
        int(row["record_id"]): row.get("title", "")
        for _, row in db_records.iterrows()
    }

    for str_id, rec_val in rankings.items():
        try:
            rec_id = int(str_id)
        except ValueError:
            return False, f"Invalid record ID: '{str_id}'. Must be an integer."

        if rec_id not in db_titles:
            return False, f"Record ID {rec_id} does not exist in the project database."

        uploaded_title = rec_val.get("title")
        if uploaded_title:
            db_title = db_titles[rec_id]
            if normalize_title(db_title) != normalize_title(uploaded_title):
                return False, (
                    f"Dataset alignment mismatch at record ID {rec_id}. "
                    f"Project DB title: '{db_title or ''}', "
                    f"Uploaded title: '{uploaded_title}'."
                )

    return True, None


