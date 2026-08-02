import { FilterList } from "@mui/icons-material";
import { Autocomplete, Checkbox, IconButton, InputBase } from "@mui/material";
import { styled } from "@mui/material/styles";
import * as React from "react";

const staticFilterOptions = [
  { value: "has_note", label: "Contains note", group: "Filters" },
  { value: "is_prior", label: "Prior knowledge", group: "Filters" },
  { value: "exclude_prior", label: "Labeled", group: "Filters" },
];

const PREFIX = "Filter";

const classes = {
  icon: `${PREFIX}-icon`,
};

const Root = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: 0,
  [`& .${classes.icon}`]: {
    color: theme.palette.text.secondary,
    [`:hover`]: {
      bgcolor: "transparent",
    },
  },
}));

export default function Filter(props) {
  const filterInput = React.useRef(null);

  const onClickFilter = () => {
    filterInput.current.focus();
  };

  const userOptions = React.useMemo(() => {
    if (!Array.isArray(props.users) || props.users.length === 0) return [];
    return props.users.map((u) => ({
      value: `user_${u.id}`,
      label: u.name || `User ${u.id}`,
      group: "Users",
    }));
  }, [props.users]);

  const options = React.useMemo(
    () => [...staticFilterOptions, ...userOptions],
    [userOptions],
  );

  return (
    <Root>
      <IconButton className={classes.icon} onClick={onClickFilter}>
        <FilterList />
      </IconButton>
      <Autocomplete
        id="filter labeled record"
        sx={{ ml: 1, display: "flex", flexGrow: 1 }}
        blurOnSelect
        disableClearable
        filterSelectedOptions
        multiple
        openOnFocus
        options={options}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => option.label}
        renderOption={(props, option, { selected }) => (
          <li {...props} key={option.value}>
            <Checkbox style={{ marginRight: 8 }} checked={selected} />
            {option.label}
          </li>
        )}
        renderInput={(params) => {
          const { InputLabelProps, InputProps, ...rest } = params;
          return (
            <InputBase
              {...params.InputProps}
              {...rest}
              sx={{ width: "100%" }}
              inputRef={filterInput}
              placeholder={!props.filterQuery.length ? "Filter" : ""}
            />
          );
        }}
        onChange={(event, value) => {
          props.setFilterQuery(value);
        }}
        value={props.filterQuery}
      />
    </Root>
  );
}
