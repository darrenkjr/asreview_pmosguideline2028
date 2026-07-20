import React from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Popover,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ProjectContext } from "context/ProjectContext";
import { useContext } from "react";
import { LoadingCardHeader } from "StyledComponents/LoadingCardheader";

import { ProjectAPI } from "api";
import { useMutation, useQuery, useQueryClient } from "react-query";

import { Add, CheckCircleOutline } from "@mui/icons-material";
import BookmarksIcon from "@mui/icons-material/Bookmarks";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import StyleIcon from "@mui/icons-material/Style";
import Grid from "@mui/material/Grid2";
import CriteriaDialog from "ProjectComponents/CriteriaDialog";
import { StyledLightBulb } from "StyledComponents/StyledLightBulb";
import { TypographySubtitle1Medium } from "StyledComponents/StyledTypography";

import EditIcon from "@mui/icons-material/Edit";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import { useToggle } from "hooks/useToggle";

const InfoPopover = ({ anchorEl, handlePopoverClose }) => {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={handlePopoverClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxWidth: 350,
        },
      }}
    >
      <Box
        sx={(theme) => ({
          p: 3,
          maxHeight: "80vh",
          overflow: "auto",
          "&::-webkit-scrollbar": {
            width: "8px",
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: theme.palette.grey[300],
            borderRadius: "4px",
            "&:hover": {
              background: theme.palette.grey[400],
            },
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
            borderRadius: "4px",
          },
          scrollbarWidth: "thin",
          scrollbarColor: `${theme.palette.grey[300]} transparent`,
        })}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Organizing with Tags
            </Typography>
            <Typography variant="body2" align="justify">
              Tags allow you to categorize records based on specific criteria,
              such as reasons for inclusion/exclusion, study characteristics, or
              quality assessment.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              Using tags consistently throughout your screening will make your
              data analysis easier after you export your project
            </Alert>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              Tag Structure
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Box
                  sx={(theme) => ({
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    height: "100%",
                    bgcolor:
                      theme.palette.mode === "light"
                        ? "background.paper"
                        : "transparent",
                  })}
                >
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <FolderOpenIcon sx={{ color: "text.secondary" }} />
                      <Typography variant="subtitle2">Tag Groups</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Create categories like "Reasons for Exclusion" or "Study
                      Design"
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box
                  sx={(theme) => ({
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    height: "100%",
                    bgcolor:
                      theme.palette.mode === "light"
                        ? "background.paper"
                        : "transparent",
                  })}
                >
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BookmarksIcon sx={{ color: "text.secondary" }} />
                      <Typography variant="subtitle2">Tags</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Add specific labels like "Wrong Population" or "Randomized
                      Controlled Trial"
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box
                  sx={(theme) => ({
                    p: 2,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    height: "100%",
                    bgcolor:
                      theme.palette.mode === "light"
                        ? "background.paper"
                        : "transparent",
                  })}
                >
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <StyleIcon sx={{ color: "text.secondary" }} />
                      <Typography variant="subtitle2">Organization</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Group related concepts together for better overview
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Box>

          <Box>
            <Button
              href="https://asreview.readthedocs.io/en/stable/lab/project_create.html#add-tags"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </Button>
          </Box>
        </Stack>
      </Box>
    </Popover>
  );
};

function labelToExport(label) {
  // Generate a suggested ID based on label
  // since Ids may be used later in data analysis code we suggest simple ascii
  // with no spaces but this is not required
  return label
    .toLowerCase()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/[^a-z0-9_]/g, "");
}

const MutateGroupDialog = ({ project_id, open, onClose, group = null }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const smallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [state, setState] = React.useState(() => {
    if (group) {
      return {
        min_selection: 0,
        ...group,
      };
    }
    return {
      label: "",
      export: "",
      min_selection: 0,
      values: [
        {
          label: "",
          export: "",
        },
        {
          label: "",
          export: "",
        },
        {
          label: "",
          export: "",
        },
      ],
    };
  });

  const { mutate: createTagGroup, error: createError } = useMutation(
    ProjectAPI.createTagGroup,
    {
      mutationKey: ["createTagGroup"],
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchTagGroups", { project_id }]);
        closeDialog();
      },
      onError: (error) => {
        console.error("An error occurred while saving the tag group:", error);
      },
    },
  );

  const { mutate: mutateTagGroup, error: mutateError } = useMutation(
    ProjectAPI.mutateTagGroup,
    {
      mutationKey: ["mutateTagGroup"],
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchTagGroups", { project_id }]);
        closeDialog();
      },
      onError: (error) => {
        console.error("An error occurred while saving the tag group:", error);
      },
    },
  );

  const handleGroupLabelChange = (e) => {
    setState((prev) => ({
      ...prev,
      label: e.target.value,
      export: labelToExport(e.target.value),
    }));
  };

  const handleGroupExportChange = (e) => {
    setState((prev) => ({
      ...prev,
      export: e.target.value,
    }));
  };

  const handleMinSelectionChange = (e) => {
    const value = Math.max(0, parseInt(e.target.value, 20) || 0);
    setState((prev) => ({
      ...prev,
      min_selection: value,
    }));
  };

  const handleTagLabelChange = (index, e) => {
    setState((prev) => ({
      ...prev,
      values: prev.values.map((tag, i) =>
        i === index
          ? {
              ...tag,
              label: e.target.value,
              export: labelToExport(e.target.value),
            }
          : tag,
      ),
    }));
  };

  const handleTagExportChange = (index, e) => {
    setState((prev) => ({
      ...prev,
      values: prev.values.map((tag, i) =>
        i === index ? { ...tag, export: e.target.value } : tag,
      ),
    }));
  };

  const addTag = () => {
    setState((prev) => ({
      ...prev,
      values: [
        ...prev.values,
        {
          label: "",
          export: "",
        },
      ],
    }));
  };

  const BulkImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const newTags = lines.map((line) => ({
        label: line,
        export: labelToExport(line),
      }));

      setState((prev) => {
        const filteredExisting = prev.values.filter(
          (tag) => tag.label || tag.export,
        );
        return {
          ...prev,
          values: [...filteredExisting, ...newTags],
        };
      });
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  const closeDialog = () => {
    if (group == null) {
      setState({
        label: "",
        export: "",
        min_selection: 0,
        values: [
          {
            label: "",
            export: "",
          },
          {
            label: "",
            export: "",
          },
          {
            label: "",
            export: "",
          },
        ],
      });
    }
    onClose();
  };

  const onSave = () => {
    if (group !== null) {
      mutateTagGroup({
        project_id,
        group: {
          ...state,
          values: state.values.filter((tag) => tag.label && tag.export),
        },
      });
    } else {
      createTagGroup({
        project_id,
        group: {
          ...state,
          values: state.values.filter((tag) => tag.label && tag.export),
        },
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      fullScreen={smallScreen}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>
        {group !== null ? "Edit group of tags" : "Add group of tags"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <TypographySubtitle1Medium>Group</TypographySubtitle1Medium>
          <Stack direction="row" spacing={3}>
            <TextField
              fullWidth
              id="group-label"
              label="Label"
              value={state.label}
              onChange={handleGroupLabelChange}
              helperText=" "
            />
            <TextField
              fullWidth
              id="group-id"
              label="Export name"
              value={state.export}
              onChange={handleGroupExportChange}
            />
          </Stack>
        </Stack>
        <TextField
          fullWidth
          type="number"
          id="group-min-selection"
          label="Minimum selections required for Relevance*"
          value={state.min_selection ?? 0}
          onChange={handleMinSelectionChange}
          inputProps={{ min: 0 }}
          helperText="*For guideline workflows, marking an article as relevant requires an assignment to particular topics. This sets the minimum number of topics that need to be assigned to a record before it is marked as relevant to the guideline as a whole (0 to disable)."
          sx={{ mb: 3 }}
        />

        <Stack spacing={3}>
          <TypographySubtitle1Medium>Tags</TypographySubtitle1Medium>
          {state.values.map((tag, index) => (
            <Stack direction="row" spacing={3} key={index}>
              <TextField
                fullWidth
                id={`tag-label-${index}`}
                label="Label"
                value={tag.label}
                onChange={(e) => handleTagLabelChange(index, e)}
              />
              <TextField
                fullWidth
                id={`tag-id-${index}`}
                label="Export name"
                value={tag.export}
                onChange={(e) => handleTagExportChange(index, e)}
              />
            </Stack>
          ))}
        </Stack>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
          sx={{ mt: 3 }}
        >
          <Tooltip title="Add tag">
            <IconButton aria-label="add tag" onClick={addTag}>
              <Add />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            component="label"
            size="small"
            startIcon={<FolderOpenIcon />}
          >
            Bulk Import Topics
            <input
              type="file"
              accept=".csv,.txt"
              hidden
              onChange={BulkImport}
            />
          </Button>
        </Stack>

        {mutateError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mutateError?.message}
          </Alert>
        )}
        {createError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {createError?.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog}>Cancel</Button>
        <Button
          onClick={onSave}
          disabled={
            !state.label ||
            !state.export ||
            state.values.filter((tag) => tag.label && tag.export).length === 0
          }
        >
          {group !== null ? "Save" : "Create Group"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Group = ({ project_id, group, isOwner }) => {
  const [dialogOpen, toggleDialogOpen] = useToggle();
  const [selectedTag, setSelectedTag] = React.useState(null);
  const [criteriaOpen, setCriteriaOpen] = React.useState(false);

  const queryClient = useQueryClient();
  const { mutate: mutateTagGroup, isLoading: isSaving } = useMutation(
    ProjectAPI.mutateTagGroup,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["fetchTagGroups", { project_id }]);
        setCriteriaOpen(false);
        setSelectedTag(null);
      },
      onError: (err) => {
        console.error("Failed to save tag group criteria:", err);
      },
    },
  );

  const handleTagClick = (tag) => {
    setSelectedTag(tag);
    setCriteriaOpen(true);
  };

  const handleSaveCriteria = (updatedCriteria) => {
    const tagIndex = group.values.findIndex((t) => t.id === selectedTag.id);
    if (tagIndex === -1) return;

    const updatedValues = [...group.values];
    updatedValues[tagIndex] = {
      ...updatedValues[tagIndex],
      criteria: updatedCriteria,
    };

    mutateTagGroup({
      project_id,
      group: {
        ...group,
        values: updatedValues,
      },
    });
  };

  return (
    <Card sx={{ mb: 2, bgcolor: "background.default" }}>
      <CardHeader
        title={group.label}
        action={
          isOwner && (
            <Tooltip title="Edit Group">
              <IconButton onClick={toggleDialogOpen}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )
        }
      />
      <CardContent>
        {group.values.map((t, index) => {
          const hasCriteria =
            t.criteria &&
            Object.values(t.criteria).some((dir) =>
              Object.values(dir).some((val) => val && val.trim() !== ""),
            );
          return (
            <Chip
              key={index}
              label={t.label}
              onClick={() => handleTagClick(t)}
              icon={
                hasCriteria ? (
                  <CheckCircleOutline fontSize="small" />
                ) : undefined
              }
              sx={{ m: 1, cursor: "pointer" }}
            />
          );
        })}
      </CardContent>
      <MutateGroupDialog
        key={group.id}
        project_id={project_id}
        open={dialogOpen}
        onClose={toggleDialogOpen}
        group={group}
      />
      <CriteriaDialog
        open={criteriaOpen}
        onClose={() => {
          setCriteriaOpen(false);
          setSelectedTag(null);
        }}
        tag={selectedTag}
        isOwner={isOwner}
        onSave={handleSaveCriteria}
        isSaving={isSaving}
      />
    </Card>
  );
};

const TagCard = () => {
  const project_id = useContext(ProjectContext);
  const [dialogOpen, toggleDialogOpen] = useToggle();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [uploadStatus, setUploadStatus] = React.useState(null);

  const { data, isLoading } = useQuery(
    ["fetchTagGroups", { project_id: project_id }],
    ProjectAPI.fetchTagGroups,
    {
      refetchOnWindowFocus: false,
    },
  );

  const { data: projectInfo } = useQuery(
    ["fetchInfo", { project_id }],
    ProjectAPI.fetchInfo,
    {
      refetchOnWindowFocus: false,
      enabled: !!project_id,
    },
  );
  const isOwner = !window.authentication || projectInfo?.roles?.owner === true;

  const [csvUploadStatus, setCsvUploadStatus] = React.useState(null);

  const { mutate: uploadRankings, isLoading: isUploading } = useMutation(
    ProjectAPI.uploadTopicRankings,
    {
      onSuccess: () => {
        setUploadStatus("success");
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
      },
      onError: (err) => {
        setUploadStatus(err?.message || "Failed to upload rankings");
      },
    },
  );

  const { mutate: uploadCSV, isLoading: isUploadingCSV } = useMutation(
    ProjectAPI.uploadTagsCSV,
    {
      onSuccess: () => {
        setCsvUploadStatus("success");
        queryClient.invalidateQueries(["fetchTagGroups", { project_id }]);
        queryClient.invalidateQueries(["fetchRecord", { project_id }]);
        queryClient.invalidateQueries(["fetchLabeledRecord", { project_id }]);
      },
      onError: (err) => {
        setCsvUploadStatus(
          err?.message || "Failed to import topics & criteria",
        );
      },
    },
  );

  const handleUploadRankings = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus(null);
    uploadRankings({ project_id, file });
    e.target.value = null;
  };

  const handleUploadCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvUploadStatus(null);
    uploadCSV({ project_id, file });
    e.target.value = null;
  };

  const queryClient = useQueryClient();

  return (
    <Card>
      <LoadingCardHeader
        title="Labeling tags"
        subheader="Tags and tag groups are used to label records with additional information"
        isLoading={isLoading}
        action={
          <IconButton
            onClick={(event) => {
              setAnchorEl(event.currentTarget);
            }}
          >
            <StyledLightBulb />
          </IconButton>
        }
      />

      <InfoPopover
        anchorEl={anchorEl}
        handlePopoverClose={() => {
          setAnchorEl(null);
        }}
      />

      <CardContent>
        {isLoading ? (
          <Skeleton variant="rectangular" height={56} />
        ) : (
          <>
            {data.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Your tags will appear here
              </Alert>
            )}
            {data.map((c, index) => (
              <Group
                key={index}
                group={c}
                project_id={project_id}
                isOwner={isOwner}
              />
            ))}
          </>
        )}
      </CardContent>

      <CardContent>
        {isLoading ? (
          <Skeleton variant="rectangular" width={100} height={36} />
        ) : (
          <Stack spacing={2}>
            <MutateGroupDialog
              project_id={project_id}
              open={dialogOpen}
              onClose={toggleDialogOpen}
            />
            {isOwner && (
              <Stack direction="row" spacing={2}>
                <Button onClick={toggleDialogOpen} variant="contained">
                  Add tags
                </Button>
                <Button
                  variant="outlined"
                  component="label"
                  disabled={isUploading || isUploadingCSV}
                >
                  {isUploadingCSV
                    ? "Importing CSV..."
                    : "Import Topics & Criteria (CSV)"}
                  <input
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={handleUploadCSV}
                  />
                </Button>
                <Button
                  variant="outlined"
                  component="label"
                  disabled={isUploading || isUploadingCSV}
                >
                  {isUploading ? "Uploading..." : "Upload Topic Rankings"}
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    onChange={handleUploadRankings}
                  />
                </Button>
              </Stack>
            )}

            {uploadStatus === "success" && (
              <Alert severity="success" onClose={() => setUploadStatus(null)}>
                Topic rankings uploaded successfully!
              </Alert>
            )}
            {uploadStatus && uploadStatus !== "success" && (
              <Alert severity="error" onClose={() => setUploadStatus(null)}>
                {uploadStatus}
              </Alert>
            )}

            {csvUploadStatus === "success" && (
              <Alert
                severity="success"
                onClose={() => setCsvUploadStatus(null)}
              >
                Topics and criteria imported successfully!
              </Alert>
            )}
            {csvUploadStatus && csvUploadStatus !== "success" && (
              <Alert severity="error" onClose={() => setCsvUploadStatus(null)}>
                {csvUploadStatus}
              </Alert>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default TagCard;
