import {
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Stack,
  Toolbar,
  useMediaQuery,
  Box,
} from "@mui/material";
import * as React from "react";

import { FileDownloadOutlined } from "@mui/icons-material";
import { useToggle } from "hooks/useToggle";
import { useParams } from "react-router-dom";
import { ExportDialog, Filter, LabeledRecord } from ".";
import { useQuery } from "react-query";
import { ProjectAPI } from "api";
import { projectStatuses } from "globals.js";

const LabelHistory = ({
  mode = "oracle",
  n_prior_inclusions = null,
  n_prior_exclusions = null,
  showFilter = true,
  filterQuery = [],
  showExport = true,
}) => {
  const { project_id } = useParams();
  const mobileScreen = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const [open, toggleOpen] = useToggle();

  const { data: projectStatusData } = useQuery(
    ["fetchProjectStatus", { project_id }],
    ProjectAPI.fetchProjectStatus,
    {
      refetchOnWindowFocus: false,
    },
  );

  const isFinished = projectStatusData?.status === projectStatuses.FINISHED;

  const [label, setLabel] = React.useState("all");
  const [state, setState] = React.useState(filterQuery);

  const { data: usersData } = useQuery(
    ["fetchProjectUsers", { project_id }],
    ProjectAPI.fetchProjectUsers,
    {
      refetchOnWindowFocus: false,
    },
  );

  const initializedUserFilter = React.useRef(false);

  React.useEffect(() => {
    if (
      Array.isArray(usersData) &&
      usersData.length > 0 &&
      !initializedUserFilter.current
    ) {
      const meUser = usersData.find((u) => u.me);
      if (meUser) {
        setState((prev) => {
          if (prev.some((f) => f.value.startsWith("user_"))) return prev;
          return [
            ...prev,
            { value: `user_${meUser.id}`, label: meUser.name, group: "Users" },
          ];
        });
      }
      initializedUserFilter.current = true;
    }
  }, [usersData]);

  const showMobileFilterRow = mobileScreen && showFilter;

  return (
    <>
      <Container maxWidth="md">
        <Toolbar
          sx={{ justifyContent: "space-between", px: 0, flexWrap: "wrap" }}
        >
          <Stack
            direction="row"
            spacing={mobileScreen ? 1 : 2}
            alignItems="center"
            justifyContent={mobileScreen ? "center" : "flex-start"}
            sx={{
              flexGrow: 1,
              minWidth: mobileScreen ? "100%" : "auto",
              mb: mobileScreen && !showMobileFilterRow ? 1 : 0,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              justifyContent="center"
            >
              <Chip
                label={"Full labeled history"}
                color="primary"
                variant={label !== "all" ? "outlined" : "filled"}
                onClick={() => {
                  setLabel("all");
                }}
              />
              <Chip
                label={
                  !n_prior_inclusions
                    ? "Relevant"
                    : `Relevant (${n_prior_inclusions})`
                }
                color="tertiary"
                variant={label !== "relevant" ? "outlined" : "filled"}
                onClick={() => {
                  setLabel("relevant");
                }}
              />
              <Chip
                label={
                  !n_prior_exclusions
                    ? "Not relevant"
                    : `Not relevant (${n_prior_exclusions})`
                }
                color="grey.600"
                variant={label !== "irrelevant" ? "outlined" : "filled"}
                onClick={() => {
                  setLabel("irrelevant");
                }}
              />
              {/*
              <Chip
                label="Skipped"
                color="warning"
                variant={label !== "skipped" ? "outlined" : "filled"}
                onClick={() => {
                  setLabel("skipped");
                }}
              />
              */}
            </Stack>
            {!mobileScreen && showFilter && (
              <Box sx={{ flexGrow: 1, minWidth: "200px" }}>
                <Filter
                  filterQuery={state}
                  setFilterQuery={setState}
                  users={usersData}
                />
              </Box>
            )}
          </Stack>
          {showExport && (!mobileScreen || !showMobileFilterRow) && (
            <Box sx={{ ml: mobileScreen ? 0 : 2 }}>
              {mobileScreen ? (
                <IconButton
                  onClick={toggleOpen}
                  color={isFinished ? "primary.contrastText" : "inherit"}
                  sx={
                    isFinished
                      ? {
                          bgcolor: "primary.main",
                          "&:hover": { bgcolor: "primary.dark" },
                        }
                      : {}
                  }
                >
                  <FileDownloadOutlined />
                </IconButton>
              ) : (
                <Button
                  onClick={toggleOpen}
                  startIcon={<FileDownloadOutlined />}
                  variant={isFinished ? "contained" : "text"}
                  color={isFinished ? "primary" : "inherit"}
                >
                  Export
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </Container>
      {!showMobileFilterRow && <Divider />}
      {showMobileFilterRow && (
        <>
          <Container maxWidth="md" sx={{ pt: 1.5, pb: 0 }}>
            <Stack
              direction="row"
              sx={{ width: "100%" }}
              alignItems="center"
              justifyContent="space-between"
            >
              <Box sx={{ flexGrow: 1, mr: 1 }}>
                <Filter
                  filterQuery={state}
                  setFilterQuery={setState}
                  users={usersData}
                />
              </Box>
              {showExport && (
                <IconButton
                  onClick={toggleOpen}
                  color={isFinished ? "primary.contrastText" : "inherit"}
                  sx={
                    isFinished
                      ? {
                          bgcolor: "primary.main",
                          "&:hover": { bgcolor: "primary.dark" },
                        }
                      : {}
                  }
                >
                  <FileDownloadOutlined />
                </IconButton>
              )}
            </Stack>
          </Container>
          <Divider sx={{ mt: 1.5 }} />
        </>
      )}
      <Container maxWidth="md" sx={{ my: 3 }}>
        <LabeledRecord
          project_id={project_id}
          mode={mode}
          label={label}
          filterQuery={state}
          setFilterQuery={setState}
        />
      </Container>
      {showExport && (
        <ExportDialog
          project_id={project_id}
          open={open}
          onClose={toggleOpen}
        />
      )}
    </>
  );
};

export default LabelHistory;
