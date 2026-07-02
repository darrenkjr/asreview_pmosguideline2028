import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Skeleton,
} from "@mui/material";
import { useQuery } from "react-query";
import { ProjectAPI } from "api";

export default function TeamStatsCard({ project_id }) {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery(
    ["fetchTeamStats", { project_id }],
    ({ queryKey }) => ProjectAPI.fetchTeamStats({ queryKey }),
    { refetchOnWindowFocus: false },
  );

  if (error) {
    return null;
  }

  if (!isLoading && (!stats || stats.length <= 1)) {
    return null;
  }

  return (
    <Card sx={{ bgcolor: "transparent", mb: 3 }}>
      <CardContent>
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ fontFamily: "Roboto Serif", mb: 2 }}
        >
          Team Screening Progress
        </Typography>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ bgcolor: "background.paper", borderRadius: 2 }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold" }}>Reviewer</TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Total Screened
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Relevant (Yes)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  Irrelevant (No)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton width={120} />
                      <Skeleton width={180} height={12} />
                    </TableCell>
                    <TableCell align="right">
                      <Skeleton width={40} sx={{ display: "inline-block" }} />
                    </TableCell>
                    <TableCell align="right">
                      <Skeleton width={40} sx={{ display: "inline-block" }} />
                    </TableCell>
                    <TableCell align="right">
                      <Skeleton width={40} sx={{ display: "inline-block" }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : stats && stats.length > 0 ? (
                stats.map((row) => (
                  <TableRow
                    key={row.user.id || row.user.email || row.user.name}
                  >
                    <TableCell>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {row.user.name}
                        </Typography>
                        {row.user.email && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {row.user.email}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {row.n_screened.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {row.n_relevant.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {row.n_not_relevant.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ py: 2 }}
                    >
                      No screening stats available yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
