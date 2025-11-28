import Select from "react-select";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";
import type { TeamMember } from "../types";

/**
 * AssigneeSelect: assign unique color per name using hash -> hue (HSL).
 * - dark: boolean to make colors softer in dark mode
 * - team: array of names
 */

function hashStr(s: string) {
  // djb2-ish
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

// hsl helpers
function hsl(h: number, s = 80, l = 50) {
  return `hsl(${h} ${s}% ${l}%)`;
}
function hsla(h: number, s = 80, l = 50, a = 1) {
  return `hsla(${h} ${s}% ${l}% / ${a})`;
}

export function AssigneeSelect({
  value,
  onChange,
  dark,
  team,
}: {
  value?: string;
  onChange: (v?: string) => void;
  dark: boolean;
  team: TeamMember[];
}) {
  const styles = makeSelectStyles(dark);
  const theme = makeSelectTheme(dark);

  const options = team.map((t: TeamMember) => {
    const hue = hashStr(t.name) % 360; // 0..359
    // choose visible text color and dot background depending on mode:
    const dot = dark ? hsla(hue, 70, 55, 0.95) : hsl(hue, 75, 45);
    const text = dark ? hsl(hue, 70, 75) : hsl(hue, 75, 25);
    return { value: t.id, label: t.name, meta: { hue, dot, text } };
  });

  const formatOptionLabel = (opt: any) => {
    const dot = opt.meta?.dot;
    return (
      <div className="flex items-center gap-2 text-sm leading-none">
        <span
          className="inline-block rounded-full"
          style={{
            width: 10,
            height: 10,
            background: dot,
            boxShadow: dark
              ? `0 0 0 6px ${hsla(opt.meta.hue, 80, 50, 0.06)}`
              : undefined,
          }}
        />
        <span>{opt.label}</span>
      </div>
    );
  };

  const SingleValue = (props: any) => {
    const opt = props.data;
    const dot = opt.meta?.dot;
    const text = opt.meta?.text;
    return (
      <div
        className="flex items-center gap-2 text-sm leading-none"
        style={{ color: text }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, background: dot }}
        />
        <span style={{ color: text }}>{opt.label}</span>
      </div>
    );
  };

  // keep control sizing consistent
  const mergedStyles = {
    ...styles,
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: 38,
      height: 38,
      borderRadius: 8,
      paddingLeft: 6,
      paddingRight: 6,
      backgroundColor: "transparent",
      boxShadow: state.isFocused ? "0 0 0 1px #0ea5e9" : "none",
      borderColor: state.isFocused ? "#0ea5e9" : provided.borderColor,
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      padding: "0 6px",
      height: 38,
      display: "flex",
      alignItems: "center",
    }),
    singleValue: (provided: any) => ({
      ...provided,
      display: "flex",
      alignItems: "center",
      gap: 8,
      lineHeight: 1,
      margin: 0,
      padding: 0,
    }),
    input: (provided: any) => ({ ...provided, margin: 0, padding: 0 }),
    indicatorsContainer: (provided: any) => ({ ...provided, height: 38 }),
  };

  return (
    <Select
      options={options}
      value={value ? options.find((o) => o.value === value) : null}
      onChange={(opt: any) => onChange(opt ? opt.value : undefined)}
      isClearable
      styles={mergedStyles}
      theme={theme}
      formatOptionLabel={formatOptionLabel}
      components={{ SingleValue }}
      classNamePrefix="cf-select"
    />
  );
}
