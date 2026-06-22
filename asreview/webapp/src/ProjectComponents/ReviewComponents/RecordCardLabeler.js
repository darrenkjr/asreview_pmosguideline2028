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

import { DeleteOutline, LabelOutlined } from "@mui/icons-material";
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

const NoteDialog = ({ project_id, record_id, open, onClose, note = null }) => {
  const queryClient = useQueryClient();

  const [noteState, setNoteState] = React.useState(note);

  const { isError, isLoading, mutate } = useMutation(ProjectAPI.mutateNote, {
    onSuccess: () => {
      queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
      queryClient.setQueryData(["fetchRecord", { project_id }], (data) => {
        return {
          ...data,
          result: {
            ...data.result,
            state: {
              ...data.result.state,
              note: noteState,
            },
          },
        };
      });
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
          onFocus={(e) =>
            e.currentTarget.setSelectionRange(
              e.currentTarget.value.length,
              e.currentTarget.value.length,
            )
          } // bug https://github.com/mui/material-ui/issues/12779
          placeholder="Write a note for this record..."
          rows={4}
          value={noteState ? noteState : ""}
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
          disabled={isLoading || noteState === note}
        >
          Save
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
) => {
  const recommended = group.values.slice(0, 5);
  if (disabled || recommended.length === 0) return null;

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
          return (
            <Tooltip
              key={`rec-${group.id}-${tag.id}`}
              title={tag.label}
              enterDelay={500}
            >
              <Chip
                label={tag.label}
                variant={isSelected ? "filled" : "outlined"}
                color={isSelected ? "primary" : "default"}
                onClick={() => {
                  if (!isSelected) {
                    onSelect(tag);
                  }
                }}
                disabled={isSelected}
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
}) => {
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
                    onChange={(newValue) => {
                      handleAutoCompleteChange(group.id, newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                          <Tooltip
                            key={key}
                            title={option.label}
                            enterDelay={500}
                          >
                            <Chip
                              variant="outlined"
                              label={option.label}
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
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...optionProps}
                          sx={{
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                          }}
                        >
                          {option.label}
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
        <Button onClick={handleSave} color="primary" disabled={isLoading}>
          Save
        </Button>
      </DialogActions>

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
  showNotes = true,
  labelTime = null,
  user = null,
  onDecisionClose = null,
  hotkeys = false,
  landscape = false,
  retrainAfterDecision = true,
  changeDecision = true,
}) => {
  const queryClient = useQueryClient();
  const [editState] = useToggle(!(label === 1 || label === 0));
  const [showNotesDialog, toggleShowNotesDialog] = useToggle(false);
  const [showTagsDialog, toggleShowTagsDialog] = useToggle(false);
  const [tagValuesState, setTagValuesState] = React.useState(
    mergeTagValues(tagsForm, tagValues),
  );

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
  const isRelevantDisabled =
    isLoading || isSuccess || (hasTags && !isAnyTagChecked);
  const [dialogLabel, setDialogLabel] = React.useState(label);
  const [showConfirmNotRelevant, setShowConfirmNotRelevant] =
    React.useState(false);

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
  useHotkeys("i", () => hotkeys && !isLoading && !isSuccess && makeDecision(0));
  useHotkeys(
    "n",
    () => hotkeys && !isLoading && !isSuccess && toggleShowNotesDialog(),
    { keyup: true },
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
                            return (
                              <Tooltip
                                key={key}
                                title={option.label}
                                enterDelay={500}
                              >
                                <Chip
                                  variant="outlined"
                                  label={option.label}
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
                          return (
                            <Box
                              component="li"
                              key={key}
                              {...optionProps}
                              sx={{
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                              }}
                            >
                              {option.label}
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
        {(note !== null || labelFromDataset !== null) && (
          <>
            <Divider />
            <CardContent>
              {note && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <NoteAltOutlinedIcon />
                    <Typography variant="subtitle1">Note</Typography>
                  </Stack>
                  <Typography sx={{ mt: 1 }}>{note}</Typography>
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
                  disabled={(disabled = { isRelevantDisabled })}
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
                title="Label as irrelevant (keyboard shortcut: I)"
                enterDelay={2000}
                leaveDelay={200}
                placement="bottom"
              >
                <Button
                  id="irrelevant"
                  onClick={() => makeDecision(0)}
                  startIcon={<NotInterestedOutlinedIcon />}
                  disabled={isLoading || isSuccess}
                  variant="contained"
                  color="grey.600"
                >
                  Not relevant
                </Button>
              </Tooltip>
            </>
          )}
          {(label === 1 || label === 0) && (
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
                  Labeled {label === 1 ? "relevant" : "not relevant"}{" "}
                  {user && formatUser(user)}{" "}
                  {timeAgo.format(new Date(labelTime * 1000))}
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
            note={note}
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
    </Stack>
  );
};

export default RecordCardLabeler;
