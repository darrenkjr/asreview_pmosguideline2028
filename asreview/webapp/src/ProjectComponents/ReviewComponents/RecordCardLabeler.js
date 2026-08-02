import {
  Box,
  Button,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid2 as Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Chip,
  Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React from "react";
import { useMutation, useQueryClient } from "react-query";

import { useHotkeys } from "react-hotkeys-hook";

import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import MoreVert from "@mui/icons-material/MoreVert";
import NotInterestedOutlinedIcon from "@mui/icons-material/NotInterestedOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import { ProjectAPI } from "api";
import { useToggle } from "hooks/useToggle";
import TimeAgo from "javascript-time-ago";

import {
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  LabelOutlined,
  SkipNextOutlined,
} from "@mui/icons-material";
import CriteriaDialog from "ProjectComponents/CriteriaDialog";
import en from "javascript-time-ago/locale/en";

TimeAgo.addLocale(en);
const timeAgo = new TimeAgo("en-US");

const formatUser = (user) => {
  if (user?.current_user) {
    return "by you";
  }
  return `by ${user.name}`;
};

const mergeTagValues = (tagsForm, tagValues) => {
  if (!tagsForm) return [];
  if (!tagValues) return structuredClone(tagsForm);
  return tagsForm.map((group) => {
    const savedGroup = tagValues.find((g) => g.id === group.id);
    return {
      ...group,
      values: group.values.map((tag) => {
        const savedTag = savedGroup?.values?.find((t) => t.id === tag.id);
        return { ...tag, checked: savedTag?.checked || false };
      }),
    };
  });
};

const NoteDialog = ({ project_id, record_id, open, onClose }) => {
  const queryClient = useQueryClient();

  const [noteState, setNoteState] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setNoteState("");
    }
  }, [open]);

  const { isError, isLoading, mutate } = useMutation(ProjectAPI.mutateNote, {
    onSuccess: () => {
      queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
      queryClient.invalidateQueries(["fetchRecord", { project_id }]);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      disableRestoreFocus // bug https://github.com/mui/material-ui/issues/33004
    >
      <DialogTitle>Add note</DialogTitle>
      <DialogContent>
        <TextField
          autoComplete="off"
          id="record-note"
          autoFocus
          fullWidth
          multiline
          onChange={(event) => setNoteState(event.target.value)}
          placeholder="Write a note for this record..."
          rows={4}
          value={noteState}
          error={isError}
          disabled={isLoading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            mutate({
              project_id: project_id,
              record_id: record_id,
              note: noteState,
            });
          }}
          color="primary"
          disabled={isLoading || !noteState || noteState.trim() === ""}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const EditNoteDialog = ({ project_id, note, open, onClose }) => {
  const queryClient = useQueryClient();

  const [noteState, setNoteState] = React.useState(note?.text || "");

  React.useEffect(() => {
    if (note) {
      setNoteState(note.text || "");
    }
  }, [note]);

  const { isError, isLoading, mutate } = useMutation(
    ProjectAPI.mutateEditNote,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        onClose();
      },
    },
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth disableRestoreFocus>
      <DialogTitle>Edit note</DialogTitle>
      <DialogContent>
        <TextField
          autoComplete="off"
          id="edit-record-note"
          autoFocus
          fullWidth
          multiline
          onChange={(event) => setNoteState(event.target.value)}
          placeholder="Edit your note..."
          rows={4}
          value={noteState}
          error={isError}
          disabled={isLoading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            mutate({
              project_id: project_id,
              note_id: note.id,
              note: noteState,
            });
          }}
          color="primary"
          disabled={
            isLoading ||
            !noteState ||
            noteState.trim() === "" ||
            noteState === note?.text
          }
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SkipDialog = ({
  project_id,
  record_id,
  open,
  onClose,
  onDecisionClose,
  onSkipSubmit,
}) => {
  const queryClient = useQueryClient();
  const [noteState, setNoteState] = React.useState("");

  const { isError, isLoading, mutate } = useMutation(
    ProjectAPI.mutateSkipRecord,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchProjectStatus", { project_id }]);
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        if (onDecisionClose) {
          onDecisionClose();
        }
        onClose();
      },
    },
  );

  const handleSkip = () => {
    let durations = {};
    if (onSkipSubmit) {
      durations = onSkipSubmit();
    }
    mutate({
      project_id,
      record_id,
      note: noteState,
      ...durations,
    });
  };

  React.useEffect(() => {
    if (open) {
      setNoteState("");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth disableRestoreFocus>
      <DialogTitle>Skip record</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Are you sure you want to skip this record? It will be returned to the
          pool and globally snoozed to the bottom of the queue.
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          id="skip-note"
          label="Why are you skipping? (optional)"
          type="text"
          fullWidth
          variant="outlined"
          multiline
          rows={3}
          value={noteState}
          onChange={(e) => setNoteState(e.target.value)}
        />
        {isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to skip record.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSkip}
          variant="contained"
          color="warning"
          disabled={isLoading}
        >
          Skip
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const renderRecommendedTopics = (
  group,
  selectedValues,
  onSelect,
  disabled = false,
  recommendedTagIds,
  onCriteriaClick,
) => {
  if (!recommendedTagIds) return null;

  const recommended = (
    Array.isArray(recommendedTagIds) ? recommendedTagIds : [recommendedTagIds]
  )
    .map((item) => {
      const id = item?.tag_id ?? item?.id ?? item;
      return group.values.find(
        (t) => t.id === id || String(t.id) === String(id),
      );
    })
    .filter(Boolean);

  if (recommended.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, fontWeight: "bold" }}
      >
        Recommended Topics
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {recommended.map((tag) => {
          const isSelected = selectedValues.some(
            (selected) => selected.id === tag.id,
          );
          const hasCriteria =
            tag.criteria &&
            Object.values(tag.criteria).some((dir) =>
              Object.values(dir).some((val) => val && val.trim() !== ""),
            );
          return (
            <Stack
              key={`rec-${group.id}-${tag.id}`}
              direction="row"
              alignItems="center"
              spacing={0.5}
            >
              <Tooltip title={tag.label} enterDelay={500}>
                <Chip
                  label={tag.label}
                  variant={isSelected ? "filled" : "outlined"}
                  color={isSelected ? "primary" : "default"}
                  onClick={() => {
                    if (!disabled && !isSelected) {
                      onSelect(tag);
                    }
                  }}
                  disabled={disabled || isSelected}
                  sx={{
                    height: "auto",
                    cursor: isSelected ? "default" : "pointer",
                    opacity: isSelected ? 0.6 : 1,
                    transition: "all 0.2s ease-in-out",
                    "& .MuiChip-label": {
                      display: "block",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      py: 0.5,
                    },
                    "&:hover": {
                      transform: isSelected ? "none" : "scale(1.05)",
                    },
                  }}
                />
              </Tooltip>
              {hasCriteria && onCriteriaClick && (
                <Tooltip title="View criteria">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCriteriaClick(tag);
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <InfoOutlined fontSize="small" color="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

const TagsDialog = ({
  project_id,
  record_id,
  label,
  tagsForm,
  tagValues,
  retrainAfterDecision,
  open,
  onClose,
  onSave,
  recommendedTags = null,
}) => {
  const [criteriaTag, setCriteriaTag] = React.useState(null);
  const [criteriaOpen, setCriteriaOpen] = React.useState(false);
  const handleCriteriaClick = (tag) => {
    setCriteriaTag(tag);
    setCriteriaOpen(true);
  };
  const queryClient = useQueryClient();
  const [localTagValues, setLocalTagValues] = React.useState(
    mergeTagValues(tagsForm, tagValues),
  );
  const [showConfirmEmpty, setShowConfirmEmpty] = React.useState(false);
  const [showConfirmRelevant, setShowConfirmRelevant] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setLocalTagValues(mergeTagValues(tagsForm, tagValues));
      setShowConfirmEmpty(false);
      setShowConfirmRelevant(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLocalAnyChecked =
    localTagValues?.some((group) => group.values.some((tag) => tag.checked)) ??
    false;

  const localTagRequirementsMet = React.useMemo(() => {
    return (
      localTagValues?.every(
        (g) =>
          (g.values?.filter((t) => t.checked).length ?? 0) >=
          (g.min_selection ?? 0),
      ) ?? true
    );
  }, [localTagValues]);

  const handleAutoCompleteChange = (groupId, newSelectedTags) => {
    let groupI = localTagValues.findIndex((group) => group.id === groupId);
    if (groupI === -1) return;
    let copy = structuredClone(localTagValues);
    copy[groupI].values = copy[groupI].values.map((tag) => {
      const isSelected = newSelectedTags.some(
        (selected) => selected.id === tag.id,
      );
      return { ...tag, checked: isSelected };
    });
    setLocalTagValues(copy);
    setShowConfirmEmpty(false);
  };

  const { isError, isLoading, mutate } = useMutation(
    ProjectAPI.mutateClassification,
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchProjectStatus", { project_id }]);
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        onSave(variables.tagValues);
        onClose();
      },
    },
  );

  const handleSave = () => {
    if (!isLocalAnyChecked) {
      setShowConfirmEmpty(true);
      return;
    }
    if (label === 0) {
      setShowConfirmRelevant(true);
      return;
    }
    mutate({
      project_id,
      record_id,
      label,
      tagValues: localTagValues,
      retrain_model: retrainAfterDecision,
      post: false,
    });
  };

  const handleConfirmRelevant = () => {
    mutate({
      project_id,
      record_id,
      label: 1,
      tagValues: localTagValues,
      retrain_model: retrainAfterDecision,
      post: false,
    });
    setShowConfirmRelevant(false);
  };

  const handleConfirmNotRelevant = () => {
    const clearedTags = structuredClone(localTagValues).map((group) => ({
      ...group,
      values: group.values.map((tag) => ({ ...tag, checked: false })),
    }));
    mutate({
      project_id,
      record_id,
      label: 0,
      tagValues: clearedTags,
      retrain_model: retrainAfterDecision,
      post: false,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Edit guideline topic assignment</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} columns={2} sx={{ pt: 1 }}>
          {tagsForm &&
            tagsForm.map((group, i) => (
              <Grid size={2} key={group.id}>
                <Stack direction="column" spacing={1}>
                  <Typography variant="h6">{group.label}</Typography>
                  {renderRecommendedTopics(
                    group,
                    localTagValues[i]?.values.filter((t) => t.checked) || [],
                    (tag) => {
                      const currentSelected =
                        localTagValues[i]?.values.filter((t) => t.checked) ||
                        [];
                      handleAutoCompleteChange(group.id, [
                        ...currentSelected,
                        tag,
                      ]);
                    },
                    false,
                    recommendedTags?.[`group_${i}`] ||
                      recommendedTags?.[`group_${group.id}`] ||
                      recommendedTags?.[group.id],
                    handleCriteriaClick,
                  )}
                  <Autocomplete
                    multiple
                    id={`tags-autocomplete-${group.id}`}
                    options={group.values}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, val) => option.id === val.id}
                    value={
                      localTagValues[i]?.values.filter((t) => t.checked) || []
                    }
                    onChange={(event, newValue) => {
                      handleAutoCompleteChange(group.id, newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        const hasCriteria =
                          option.criteria &&
                          Object.values(option.criteria).some((dir) =>
                            Object.values(dir).some(
                              (val) => val && val.trim() !== "",
                            ),
                          );
                        return (
                          <Tooltip
                            key={key}
                            title={option.label}
                            enterDelay={500}
                          >
                            <Chip
                              variant="outlined"
                              label={
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  spacing={0.5}
                                >
                                  <span>{option.label}</span>
                                  {hasCriteria && (
                                    <InfoOutlined
                                      fontSize="small"
                                      color="inherit"
                                      sx={{ cursor: "pointer", ml: 0.5 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCriteriaClick(option);
                                      }}
                                    />
                                  )}
                                </Stack>
                              }
                              {...tagProps}
                              sx={{
                                height: "auto",
                                maxWidth: "100%",
                                "& .MuiChip-label": {
                                  display: "block",
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                  py: 0.5,
                                },
                              }}
                            />
                          </Tooltip>
                        );
                      })
                    }
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props;
                      const hasCriteria =
                        option.criteria &&
                        Object.values(option.criteria).some((dir) =>
                          Object.values(dir).some(
                            (val) => val && val.trim() !== "",
                          ),
                        );
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...optionProps}
                          sx={{
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>{option.label}</span>
                          {hasCriteria && (
                            <Tooltip title="View criteria">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleCriteriaClick(option);
                                }}
                                sx={{ p: 0.25, ml: 1 }}
                              >
                                <InfoOutlined
                                  fontSize="small"
                                  color="inherit"
                                />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="outlined"
                        label={`Select ${group.label}`}
                        placeholder="Search guideline topics..."
                      />
                    )}
                    disabled={isLoading}
                  />
                </Stack>
              </Grid>
            ))}
        </Grid>
        {isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to update tags.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          disabled={
            isLoading || (isLocalAnyChecked && !localTagRequirementsMet)
          }
        >
          Save
        </Button>
      </DialogActions>

      <CriteriaDialog
        open={criteriaOpen}
        onClose={() => {
          setCriteriaOpen(false);
          setCriteriaTag(null);
        }}
        tag={criteriaTag}
        isOwner={false}
        onSave={() => {}}
        isSaving={false}
      />

      <Dialog
        open={showConfirmEmpty}
        onClose={() => setShowConfirmEmpty(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Topic Removal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body1">
              No topic is assigned to this record.
            </Typography>
            <Alert severity="warning">
              Saving with no topics will mark this record as{" "}
              <strong>not relevant</strong>.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmEmpty(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setShowConfirmEmpty(false);
              handleConfirmNotRelevant();
            }}
            variant="contained"
            color="warning"
            disabled={isLoading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showConfirmRelevant}
        onClose={() => setShowConfirmRelevant(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Topic Reassignments</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body1">
              No topic was previously assigned to this record.
            </Typography>
            <Alert severity="info">
              Saving these topic assignments will mark this record as{" "}
              <strong>relevant</strong>.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmRelevant(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmRelevant}
            variant="contained"
            color="primary"
            disabled={isLoading}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

const RecordCardLabeler = ({
  project_id,
  record_id,
  label,
  labelFromDataset = null,
  tagsForm,
  tagValues = null,
  note = null,
  notes = null,
  showNotes = true,
  labelTime = null,
  user = null,
  onDecisionClose = null,
  hotkeys = false,
  landscape = false,
  retrainAfterDecision = true,
  changeDecision = true,
  recommendedTags = null,
  captureDuration = false,
}) => {
  const queryClient = useQueryClient();
  const [editState] = useToggle(!(label === 1 || label === 0));
  const [showNotesDialog, toggleShowNotesDialog] = useToggle(false);
  const [showSkipDialog, toggleShowSkipDialog] = useToggle(false);
  const [showTagsDialog, toggleShowTagsDialog] = useToggle(false);
  const [tagValuesState, setTagValuesState] = React.useState(
    mergeTagValues(tagsForm, tagValues),
  );
  const [inlineCriteriaTag, setInlineCriteriaTag] = React.useState(null);
  const [inlineCriteriaOpen, setInlineCriteriaOpen] = React.useState(false);

  const startTimeRef = React.useRef(performance.now());
  const awayAccumRef = React.useRef(0);
  const awaySinceRef = React.useRef(null);
  const focusedRef = React.useRef(true);

  React.useEffect(() => {
    const now = performance.now();
    startTimeRef.current = now;
    awayAccumRef.current = 0;
    focusedRef.current = document.hasFocus();
    awaySinceRef.current = document.hidden || !focusedRef.current ? now : null;

    const sync = (nextFocused) => {
      const t = performance.now();
      if (typeof nextFocused === "boolean") focusedRef.current = nextFocused;
      const away = document.hidden || !focusedRef.current; // considered away when current tab / document is away or current window is not focused
      if (away && awaySinceRef.current === null) {
        awaySinceRef.current = t; // start away timer
      } else if (!away && awaySinceRef.current !== null) {
        awayAccumRef.current += t - awaySinceRef.current; // calculate time accumulated in an away status
        awaySinceRef.current = null; // reset away timer
      }
    };

    const onVis = () => sync();
    const onBlur = () => sync(false);
    const onFocus = () => sync(true);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [record_id]);

  // Screening duration analytics: capture presentation-anchored timing for queue first decisions
  const computeDurations = React.useCallback(() => {
    if (!captureDuration || !editState) {
      return {};
    }
    const now = performance.now();
    if (awaySinceRef.current !== null) {
      awayAccumRef.current += now - awaySinceRef.current;
      awaySinceRef.current = null;
    }
    const duration_raw = (now - startTimeRef.current) / 1000;
    const duration_away = awayAccumRef.current / 1000;
    return { duration_raw, duration_away };
  }, [captureDuration, editState]);

  const handleInlineCriteriaClick = (tag) => {
    setInlineCriteriaTag(tag);
    setInlineCriteriaOpen(true);
  };

  const [editingNote, setEditingNote] = React.useState(null);

  const deleteNoteMutation = useMutation(ProjectAPI.mutateDeleteNote, {
    onSuccess: () => {
      queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
      queryClient.invalidateQueries(["fetchRecord", { project_id }]);
    },
  });

  const allNotes = React.useMemo(() => {
    return notes || [];
  }, [notes]);

  const { error, isError, isLoading, mutate, isSuccess } = useMutation(
    ProjectAPI.mutateClassification,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchProjectStatus", { project_id }]);
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        if (onDecisionClose) {
          onDecisionClose();
        }
      },
    },
  );

  const hasTags = Array.isArray(tagsForm) && tagsForm.length > 0;
  const isAnyTagChecked =
    tagValuesState?.some((group) => group.values?.some((tag) => tag.checked)) ??
    false;
  const tagRequirementsMet =
    tagValuesState?.every(
      (g) =>
        (g.values?.filter((t) => t.checked).length ?? 0) >=
        (g.min_selection ?? 0),
    ) ?? true;
  const isAlreadySkipped =
    labelTime !== null && (label === null || label === undefined);
  const isRelevantDisabled =
    isLoading || isSuccess || (hasTags && !tagRequirementsMet);
  const [dialogLabel, setDialogLabel] = React.useState(label);
  const [showConfirmNotRelevant, setShowConfirmNotRelevant] =
    React.useState(false);
  const isNotRelevantDisabled = isLoading || isSuccess || isAnyTagChecked;

  const handleInlineAutocompleteChange = (groupId, newSelectedTags) => {
    let groupI = tagValuesState.findIndex((group) => group.id === groupId);
    if (groupI === -1) return;

    let tagValuesCopy = structuredClone(tagValuesState);
    tagValuesCopy[groupI].values = tagValuesCopy[groupI].values.map((tag) => {
      const isSelected = newSelectedTags.some(
        (selected) => selected.id === tag.id,
      );
      return { ...tag, checked: isSelected };
    });
    setTagValuesState(tagValuesCopy);
  };

  const makeDecision = (label) => {
    mutate({
      project_id: project_id,
      record_id: record_id,
      label: label,
      tagValues: tagValuesState,
      retrain_model: retrainAfterDecision,
      post: editState,
      ...computeDurations(),
    });
  };

  const handleConfirmChangeToNotRelevant = () => {
    const clearedTags = structuredClone(tagValuesState).map((group) => ({
      ...group,
      values: group.values.map((tag) => ({ ...tag, checked: false })),
    }));
    setTagValuesState(clearedTags);
    mutate({
      project_id: project_id,
      record_id: record_id,
      label: 0,
      tagValues: clearedTags,
      retrain_model: retrainAfterDecision,
      post: editState,
      ...computeDurations(),
    });
    setShowConfirmNotRelevant(false);
  };

  const handleChangeDecision = () => {
    if (label === 1) {
      if (hasTags && isAnyTagChecked) {
        setShowConfirmNotRelevant(true);
      } else {
        // Relevant → Not Relevant: clear all topic assignments and save
        const clearedTags = hasTags
          ? structuredClone(tagValuesState).map((group) => ({
              ...group,
              values: group.values.map((tag) => ({ ...tag, checked: false })),
            }))
          : tagValuesState;
        setTagValuesState(clearedTags);
        mutate({
          project_id: project_id,
          record_id: record_id,
          label: 0,
          tagValues: clearedTags,
          retrain_model: retrainAfterDecision,
          post: editState,
          ...computeDurations(),
        });
      }
    } else {
      // Not Relevant → Relevant: prompt for topic selection if tags configured
      if (hasTags) {
        setDialogLabel(1);
        toggleShowTagsDialog();
      } else {
        makeDecision(1);
      }
    }
    setAnchorEl(null);
  };

  const [anchorEl, setAnchorEl] = React.useState(null);
  const openMenu = Boolean(anchorEl);

  useHotkeys("r", () => hotkeys && !isRelevantDisabled && makeDecision(1));
  useHotkeys("i", () => hotkeys && !isNotRelevantDisabled && makeDecision(0));
  useHotkeys(
    "n",
    () => hotkeys && !isLoading && !isSuccess && toggleShowNotesDialog(),
    { keyup: true },
  );
  useHotkeys(
    "s",
    () => hotkeys && !isLoading && !isSuccess && toggleShowSkipDialog(),
  );

  return (
    <Stack
      sx={(theme) => ({
        bgcolor: alpha(
          label === 1
            ? alpha(theme.palette.tertiary.main, 1)
            : label === 0
              ? alpha(theme.palette.grey[600], 1)
              : alpha(theme.palette.secondary.dark, 1),

          theme.palette.action.selectedOpacity * 1.5,
        ),
        justifyContent: "space-between",
        alignItems: "stretch",
        height: "100%",
      })}
    >
      <Box>
        {hasTags && (
          <CardContent>
            <Grid container spacing={2} columns={2}>
              {tagsForm &&
                tagsForm.map((group, i) => (
                  <Grid
                    size={
                      tagsForm.length === 1
                        ? 2
                        : landscape
                          ? 2
                          : { xs: 2, sm: 1 }
                    }
                    key={group.id}
                  >
                    <Stack direction="column" spacing={1}>
                      <Typography variant="h6">{group.label}</Typography>

                      {renderRecommendedTopics(
                        group,
                        tagValuesState[i]?.values.filter((t) => t.checked) ||
                          [],
                        (tag) => {
                          const currentSelected =
                            tagValuesState[i]?.values.filter(
                              (t) => t.checked,
                            ) || [];
                          handleInlineAutocompleteChange(group.id, [
                            ...currentSelected,
                            tag,
                          ]);
                        },
                        !editState || !changeDecision || isLoading || isSuccess,
                        recommendedTags?.[`group_${i}`] ||
                          recommendedTags?.[`group_${group.id}`] ||
                          recommendedTags?.[group.id],
                        handleInlineCriteriaClick,
                      )}
                      <Autocomplete
                        multiple
                        id={`inline-tags-autocomplete-${group.id}`}
                        options={group.values}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, val) =>
                          option.id === val.id
                        }
                        value={
                          tagValuesState[i]?.values.filter((t) => t.checked) ||
                          []
                        }
                        onChange={(event, newValue) => {
                          handleInlineAutocompleteChange(group.id, newValue);
                        }}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => {
                            const { key, ...tagProps } = getTagProps({ index });
                            const hasCriteria =
                              option.criteria &&
                              Object.values(option.criteria).some((dir) =>
                                Object.values(dir).some(
                                  (val) => val && val.trim() !== "",
                                ),
                              );
                            return (
                              <Tooltip
                                key={key}
                                title={option.label}
                                enterDelay={500}
                              >
                                <Chip
                                  variant="outlined"
                                  label={
                                    <Stack
                                      direction="row"
                                      alignItems="center"
                                      spacing={0.5}
                                    >
                                      <span>{option.label}</span>
                                      {hasCriteria && (
                                        <InfoOutlined
                                          fontSize="small"
                                          color="inherit"
                                          sx={{ cursor: "pointer", ml: 0.5 }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleInlineCriteriaClick(option);
                                          }}
                                        />
                                      )}
                                    </Stack>
                                  }
                                  {...tagProps}
                                  sx={{
                                    height: "auto",
                                    maxWidth: "100%",
                                    "& .MuiChip-label": {
                                      display: "block",
                                      whiteSpace: "normal",
                                      wordBreak: "break-word",
                                      py: 0.5,
                                    },
                                  }}
                                />
                              </Tooltip>
                            );
                          })
                        }
                        renderOption={(props, option) => {
                          const { key, ...optionProps } = props;
                          const hasCriteria =
                            option.criteria &&
                            Object.values(option.criteria).some((dir) =>
                              Object.values(dir).some(
                                (val) => val && val.trim() !== "",
                              ),
                            );
                          return (
                            <Box
                              component="li"
                              key={key}
                              {...optionProps}
                              sx={{
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span>{option.label}</span>
                              {hasCriteria && (
                                <Tooltip title="View criteria">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleInlineCriteriaClick(option);
                                    }}
                                    sx={{ p: 0.25, ml: 1 }}
                                  >
                                    <InfoOutlined
                                      fontSize="small"
                                      color="inherit"
                                    />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            label={`Select ${group.label}`}
                            placeholder="Search topics..."
                          />
                        )}
                        disabled={
                          !editState ||
                          !changeDecision ||
                          isLoading ||
                          isSuccess
                        }
                      />
                    </Stack>
                  </Grid>
                ))}
            </Grid>
          </CardContent>
        )}
      </Box>
      <Box>
        {(allNotes.length > 0 || labelFromDataset !== null) && (
          <>
            <Divider />
            <CardContent>
              {allNotes.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: "background.default",
                    borderRadius: 2,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <NoteAltOutlinedIcon />
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold" }}
                      >
                        Notes
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack spacing={2}>
                      {allNotes.map((noteItem, idx) => (
                        <Box key={noteItem.id || idx}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ mb: 0.5 }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: "bold",
                                  color: "primary.main",
                                }}
                              >
                                {noteItem.user
                                  ? noteItem.user.current_user
                                    ? "You"
                                    : noteItem.user.name
                                  : "Anonymous"}
                              </Typography>
                              {noteItem.created_at && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  •{" "}
                                  {timeAgo.format(
                                    new Date(noteItem.created_at * 1000),
                                  )}
                                </Typography>
                              )}
                              {noteItem.edited_at && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontStyle: "italic" }}
                                >
                                  (edited{" "}
                                  {timeAgo.format(
                                    new Date(noteItem.edited_at * 1000),
                                  )}
                                  )
                                </Typography>
                              )}
                            </Stack>
                            {noteItem.user?.current_user && noteItem.id && (
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={() => setEditingNote(noteItem)}
                                  title="Edit note"
                                >
                                  <EditOutlined fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    deleteNoteMutation.mutate({
                                      project_id,
                                      note_id: noteItem.id,
                                    })
                                  }
                                  title="Delete note"
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Stack>
                            )}
                          </Stack>
                          <Typography
                            variant="body2"
                            sx={{
                              pl: 0.5,
                              color: "text.primary",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {noteItem.text}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {labelFromDataset === 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LabelOutlined />
                    <Typography variant="subtitle1">Not relevant</Typography>
                  </Stack>
                  <Typography sx={{ mt: 1 }}>
                    This record is labeled as not relevant in the dataset
                  </Typography>
                </Paper>
              )}
              {labelFromDataset === 1 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LabelOutlined />
                    <Typography variant="subtitle1">Relevant</Typography>
                  </Stack>
                  <Typography sx={{ mt: 1 }}>
                    This record is labeled as relevant in the dataset
                  </Typography>
                </Paper>
              )}
            </CardContent>
          </>
        )}

        {isError && (
          <CardContent>
            <Alert severity="error">
              Failed to label record. {error?.message}
            </Alert>
          </CardContent>
        )}
        <CardActions
          sx={(theme) => ({
            bgcolor:
              label === 1
                ? alpha(theme.palette.tertiary.main, 1)
                : label === 0
                  ? alpha(theme.palette.grey[600], 1)
                  : null,
          })}
        >
          {editState && (
            <>
              <Tooltip
                title="Label as relevant (keyboard shortcut: R)"
                enterDelay={2000}
                leaveDelay={200}
                placement="bottom"
              >
                <Button
                  id="relevant"
                  onClick={() => makeDecision(1)}
                  variant="contained"
                  startIcon={<LibraryAddOutlinedIcon />}
                  disabled={isRelevantDisabled}
                  sx={(theme) => ({
                    color: theme.palette.getContrastText(
                      theme.palette.tertiary.main,
                    ),
                    bgcolor: theme.palette.tertiary.main,
                  })}
                >
                  Relevant
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  isAnyTagChecked
                    ? "The record has selected tags / topics - remove these tags to mark as not relevant"
                    : "Label as irrelevant (keyboard shortcut: I)"
                }
                enterDelay={2000}
                leaveDelay={200}
                placement="bottom"
              >
                <Button
                  id="irrelevant"
                  onClick={() => makeDecision(0)}
                  startIcon={<NotInterestedOutlinedIcon />}
                  disabled={isNotRelevantDisabled}
                  variant="contained"
                  color="grey.600"
                >
                  Not relevant
                </Button>
              </Tooltip>
              {!isAlreadySkipped && (
                <Tooltip title="Skip this record (keyboard shortcut: S)">
                  <Button
                    id="skip"
                    onClick={toggleShowSkipDialog}
                    startIcon={<SkipNextOutlined />}
                    disabled={isLoading || isSuccess}
                    variant="outlined"
                    color="warning"
                  >
                    Skip
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          {(label === 1 || label === 0 || isAlreadySkipped) && (
            <>
              {!landscape && (
                <Typography
                  variant="secondary"
                  sx={(theme) => ({
                    pl: 1,
                    color:
                      label === 1
                        ? theme.palette.getContrastText(
                            theme.palette.tertiary.main,
                          )
                        : label === 0
                          ? theme.palette.getContrastText(
                              theme.palette.grey[600],
                            )
                          : theme.palette.text.primary,
                  })}
                >
                  {label === 1 || label === 0
                    ? `Labeled ${label === 1 ? "relevant" : "not relevant"} `
                    : "Skipped "}
                  {user && formatUser(user)}{" "}
                  {labelTime && timeAgo.format(new Date(labelTime * 1000))}
                </Typography>
              )}
            </>
          )}
          <Box sx={{ flexGrow: 1 }} />

          {editState && showNotes && (
            <>
              <Tooltip
                title="Add note (keyboard shortcut: N)"
                enterDelay={2000}
                leaveDelay={200}
                placement="bottom"
              >
                <IconButton
                  onClick={toggleShowNotesDialog}
                  aria-label="add note"
                  disabled={isLoading || isSuccess}
                  sx={(theme) => ({
                    // color: theme.palette.getContrastText(
                    //   theme.palette.secondary.dark,
                    // ),
                  })}
                >
                  <NoteAltOutlinedIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          {(label === 1 || label === 0) && changeDecision && (
            <>
              <Tooltip title="Options">
                <IconButton
                  id="card-positioned-button"
                  aria-controls={openMenu ? "card-positioned-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={openMenu ? "true" : undefined}
                  onClick={(event) => setAnchorEl(event.currentTarget)}
                  sx={(theme) => ({
                    color:
                      label === 1
                        ? theme.palette.getContrastText(
                            theme.palette.tertiary.main,
                          )
                        : label === 0
                          ? theme.palette.getContrastText(
                              theme.palette.grey[600],
                            )
                          : theme.palette.action.primary,
                  })}
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>

              <Menu
                id="card-positioned-menu"
                aria-labelledby="card-positioned-button"
                anchorEl={anchorEl}
                open={openMenu}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
              >
                {/* toggle label */}
                {(label === 1 || label === 0) && (
                  <MenuItem onClick={handleChangeDecision}>
                    <ListItemIcon>
                      {label === 1 ? (
                        <NotInterestedOutlinedIcon />
                      ) : (
                        <LibraryAddOutlinedIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        label === 1
                          ? "Change to Not Relevant"
                          : "Change to Relevant"
                      }
                    />
                  </MenuItem>
                )}
                {hasTags && (
                  <MenuItem
                    onClick={() => {
                      setDialogLabel(label);
                      toggleShowTagsDialog();
                      setAnchorEl(null);
                    }}
                  >
                    <ListItemIcon>
                      <LabelOutlined />
                    </ListItemIcon>
                    <ListItemText primary="Edit topic assignment" />
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    toggleShowNotesDialog();
                    setAnchorEl(null);
                  }}
                >
                  <ListItemIcon>
                    <NoteAltOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText primary={note ? "Change note" : "Add note"} />
                </MenuItem>
                <MenuItem onClick={() => {}} disabled>
                  <ListItemIcon>
                    <DeleteOutline />
                  </ListItemIcon>
                  <ListItemText
                    primary={"Remove my label"}
                    secondary={"Coming soon"}
                  />
                </MenuItem>
              </Menu>
            </>
          )}
          <NoteDialog
            project_id={project_id}
            record_id={record_id}
            open={showNotesDialog}
            onClose={toggleShowNotesDialog}
          />
          <EditNoteDialog
            project_id={project_id}
            note={editingNote}
            open={Boolean(editingNote)}
            onClose={() => setEditingNote(null)}
          />
          <SkipDialog
            project_id={project_id}
            record_id={record_id}
            open={showSkipDialog}
            onClose={toggleShowSkipDialog}
            onDecisionClose={onDecisionClose}
            onSkipSubmit={computeDurations}
          />
          {hasTags && (
            <TagsDialog
              project_id={project_id}
              record_id={record_id}
              label={dialogLabel}
              tagsForm={tagsForm}
              tagValues={tagValuesState}
              retrainAfterDecision={retrainAfterDecision}
              open={showTagsDialog}
              onClose={toggleShowTagsDialog}
              onSave={setTagValuesState}
              recommendedTags={recommendedTags}
            />
          )}
          <Dialog
            open={showConfirmNotRelevant}
            onClose={() => setShowConfirmNotRelevant(false)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Confirm Relevance Change</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body1">
                  Are you sure you want to mark this record as not relevant?
                </Typography>
                <Alert severity="warning">
                  This will remove all assigned topics from this record.
                </Alert>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowConfirmNotRelevant(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmChangeToNotRelevant}
                variant="contained"
                color="warning"
                disabled={isLoading}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </CardActions>
      </Box>
      <CriteriaDialog
        open={inlineCriteriaOpen}
        onClose={() => {
          setInlineCriteriaOpen(false);
          setInlineCriteriaTag(null);
        }}
        tag={inlineCriteriaTag}
        isOwner={false}
        onSave={() => {}}
        isSaving={false}
      />
    </Stack>
  );
};

export default RecordCardLabeler;
