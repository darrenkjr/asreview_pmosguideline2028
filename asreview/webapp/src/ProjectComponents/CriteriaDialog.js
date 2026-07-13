import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";

const CriteriaDialog = ({
  open,
  onClose,
  tag,
  isOwner = false,
  onSave,
  isSaving = false,
}) => {
  const defaultDims = ["Population", "Intervention", "Comparison", "Outcome"];
  const existingDims = React.useMemo(() => {
    if (!tag?.criteria) return [];
    return [
      ...new Set([
        ...Object.keys(tag.criteria.inclusion || {}),
        ...Object.keys(tag.criteria.exclusion || {}),
      ]),
    ];
  }, [tag]);

  const [dimensions, setDimensions] = React.useState(() => {
    return [...new Set([...defaultDims, ...existingDims])];
  });

  const [criteriaState, setCriteriaState] = React.useState({
    inclusion: {},
    exclusion: {},
  });

  const [newDimName, setNewDimName] = React.useState("");

  React.useEffect(() => {
    if (tag) {
      const criteria = tag.criteria || {};
      const inclusion = criteria.inclusion || {};
      const exclusion = criteria.exclusion || {};
      setCriteriaState({
        inclusion: { ...inclusion },
        exclusion: { ...exclusion },
      });
      setDimensions([...new Set([...defaultDims, ...existingDims])]); // eslint-disable-line react-hooks/exhaustive-deps
    }
  }, [tag, existingDims]);

  const handleCellChange = (direction, dimension, value) => {
    setCriteriaState((prev) => ({
      ...prev,
      [direction]: {
        ...prev[direction],
        [dimension]: value,
      },
    }));
  };

  const handleAddDimension = () => {
    const trimmed = newDimName.trim();
    if (!trimmed) return;
    const formatted = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
    if (!dimensions.includes(formatted)) {
      setDimensions((prev) => [...prev, formatted]);
    }
    setNewDimName("");
  };

  const handleSave = () => {
    const cleaned = { inclusion: {}, exclusion: {} };
    dimensions.forEach((dim) => {
      const incVal = (criteriaState.inclusion[dim] || "").trim();
      const excVal = (criteriaState.exclusion[dim] || "").trim();
      cleaned.inclusion[dim] = incVal;
      cleaned.exclusion[dim] = excVal;
    });
    onSave(cleaned);
  };

  const hasAnyExclusion =
    isOwner ||
    dimensions.some(
      (dim) => (criteriaState.exclusion[dim] || "").trim() !== "",
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isOwner
          ? `Edit Criteria: ${tag?.label}`
          : `View Criteria: ${tag?.label}`}
      </DialogTitle>
      <DialogContent>
        <Table size="small" sx={{ mt: 1 }}>
          {/* Inclusion Criteria Section */}
          <TableHead>
            <TableRow>
              <TableCell
                colSpan={2}
                sx={{
                  fontWeight: "bold",
                  fontSize: "1rem",
                  bgcolor: "success.light",
                  color: "success.contrastText",
                  py: 1.5,
                }}
              >
                Inclusion Criteria
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dimensions.map((dim) => (
              <TableRow key={`inc-${dim}`}>
                <TableCell
                  sx={{
                    fontWeight: "bold",
                    verticalAlign: "top",
                    width: "30%",
                  }}
                >
                  {dim}
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    value={criteriaState.inclusion[dim] || ""}
                    onChange={(e) =>
                      handleCellChange("inclusion", dim, e.target.value)
                    }
                    disabled={!isOwner || isSaving}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          {/* Exclusion Criteria Section — hidden when all empty (non-owner) */}
          {hasAnyExclusion && (
            <>
              <TableHead>
                <TableRow>
                  <TableCell
                    colSpan={2}
                    sx={{
                      fontWeight: "bold",
                      fontSize: "1rem",
                      bgcolor: "error.light",
                      color: "error.contrastText",
                      py: 1.5,
                    }}
                  >
                    Exclusion Criteria
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dimensions.map((dim) => (
                  <TableRow key={`exc-${dim}`}>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        verticalAlign: "top",
                        width: "30%",
                      }}
                    >
                      {dim}
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                        value={criteriaState.exclusion[dim] || ""}
                        onChange={(e) =>
                          handleCellChange("exclusion", dim, e.target.value)
                        }
                        disabled={!isOwner || isSaving}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>

        {isOwner && (
          <Stack
            direction="row"
            spacing={2}
            sx={{ mt: 2, alignItems: "center" }}
          >
            <TextField
              size="small"
              label="New Custom Dimension"
              value={newDimName}
              onChange={(e) => setNewDimName(e.target.value)}
              disabled={isSaving}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddDimension}
              disabled={!newDimName.trim() || isSaving}
            >
              Add Dimension
            </Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {isOwner ? "Cancel" : "Close"}
        </Button>
        {isOwner && (
          <Button onClick={handleSave} variant="contained" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CriteriaDialog;
