import {
  Box,
  Button,
  ButtonBase,
  Fade,
  Stack,
  Typography,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import React from "react";
import { InView } from "react-intersection-observer";
import { useInfiniteQuery } from "react-query";

import { InlineErrorHandler } from "Components";
import { RecordCard } from "ProjectComponents/ReviewComponents";
import { ProjectAPI } from "api";

import { useMediaQuery } from "@mui/material";
import { useReviewSettings } from "context/ReviewSettingsContext";

const LabeledRecord = ({
  project_id,
  label,
  filterQuery,
  setFilterQuery,
  mode = "oracle",
}) => {
  const { orientation, modelLogLevel, expandAbstract } = useReviewSettings();

  let landscapeDisabled = useMediaQuery(
    (theme) => theme.breakpoints.down("md"),
    {
      noSsr: true,
    },
  );

  const userFilters = React.useMemo(
    () =>
      filterQuery
        .filter((filter) => filter.value.startsWith("user_"))
        .map((filter) => parseInt(filter.value.replace("user_", ""))),
    [filterQuery],
  );

  const regularFilters = React.useMemo(
    () =>
      filterQuery
        .filter((filter) => !filter.value.startsWith("user_"))
        .map((filter) => filter.value),
    [filterQuery],
  );

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetched,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    [
      "fetchLabeledRecord",
      {
        project_id: project_id,
        subset: label,
        filter: regularFilters,
        user_id: userFilters,
      },
    ],
    ProjectAPI.fetchLabeledRecord,
    {
      getNextPageParam: (lastPage) => lastPage.next_page ?? false,
    },
  );

  /**
   * Check if this component is mounted
   */
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <Box aria-label="labeled record">
      {isError && <InlineErrorHandler message={error?.message} />}
      {!isError &&
        !(isLoading || !mounted.current) &&
        isFetched &&
        data?.pages[0]?.result?.length === 0 && (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No decisions found matching the selected filters.
            </Typography>
            {filterQuery && filterQuery.length > 0 && (
              <Button
                variant="outlined"
                onClick={() => setFilterQuery && setFilterQuery([])}
                sx={{ mt: 1 }}
              >
                Clear filters
              </Button>
            )}
          </Box>
        )}
      {!isError &&
        !(isLoading || !mounted.current) &&
        isFetched &&
        data?.pages[0]?.result?.length > 0 && (
          <Fade in={!isError && !(isLoading || !mounted.current) && isFetched}>
            <Stack aria-label="labeled record card" spacing={5}>
              {isFetched &&
                data?.pages.map((page) =>
                  page.result.map((record) => (
                    <RecordCard
                      project_id={project_id}
                      record={record}
                      collapseAbstract={!expandAbstract}
                      disabled={true}
                      transitionType="collapse"
                      transitionSpeed={{ enter: 500, exit: 800 }}
                      landscape={
                        orientation === "landscape" && !landscapeDisabled
                      }
                      modelLogLevel={modelLogLevel}
                      changeDecision={mode === "oracle"}
                      key={
                        "record-card-" +
                        project_id +
                        "-" +
                        record?.record_id +
                        "-" +
                        record?.state?.note +
                        "-" +
                        JSON.stringify(record?.tags_form)
                      }
                    />
                  )),
                )}
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <InView
                  as="div"
                  onChange={(inView, entry) => {
                    if (inView && hasNextPage && !isFetchingNextPage) {
                      fetchNextPage();
                    }
                  }}
                >
                  <ButtonBase disabled={!hasNextPage || isFetchingNextPage}>
                    <Typography
                      gutterBottom
                      variant="button"
                      sx={{ color: grey[500] }}
                    >
                      {isFetchingNextPage
                        ? "Loading more..."
                        : hasNextPage
                          ? "Load More"
                          : "Nothing more to load"}
                    </Typography>
                  </ButtonBase>
                </InView>
              </Box>
            </Stack>
          </Fade>
        )}
    </Box>
  );
};

export default LabeledRecord;
