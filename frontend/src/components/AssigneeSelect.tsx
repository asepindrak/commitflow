import Select from "react-select";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";
import type { TeamMember } from "../types";

function hashStr(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

function hsl(h: number, s = 80, l = 50) {
  return `hsl(${h} ${s}% ${l}%)`;
}
function hsla(h: number, s = 80, l = 50, a = 1) {
  return `hsla(${h} ${s}% ${l}% / ${a})`;
}

type Option = {
  value: string;
  label: string;
  meta: {
    hue: number;
    dot: string;
    text: string;
  };
};

export function AssigneeSelect({
  value,
  onChange,
  dark,
  team,
  multiple = false,
}: {
  value?: string | string[];
  onChange: (v: string | string[] | undefined) => void;
  dark: boolean;
  team: TeamMember[];
  multiple?: boolean;
}) {
  const styles = makeSelectStyles(dark);
  const theme = makeSelectTheme(dark);

  const options: Option[] = team.map((t) => {
    const hue = hashStr(t.name || "A") % 360;
    const dot = dark ? hsla(hue, 70, 55, 0.95) : hsl(hue, 75, 45);
    const text = dark ? hsl(hue, 70, 75) : hsl(hue, 75, 25);

    return {
      value: String(t.id),
      label: t.name,
      meta: { hue, dot, text },
    };
  });

  const formatOptionLabel = (opt: Option) => (
    <div className="flex items-center gap-2 text-sm leading-none">
      <span
        className="inline-block rounded-full"
        style={{
          width: 10,
          height: 10,
          background: opt.meta.dot,
          boxShadow: dark
            ? `0 0 0 6px ${hsla(opt.meta.hue, 80, 50, 0.06)}`
            : undefined,
        }}
      />
      <span>{opt.label}</span>
    </div>
  );

  const SingleValue = (props: any) => {
    const opt: Option = props.data;
    return (
      <div
        className="flex items-center gap-2 text-sm"
        style={{ color: opt.meta.text }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, background: opt.meta.dot }}
        />
        <span>{opt.label}</span>
      </div>
    );
  };

  const MultiValueLabel = (props: any) => {
    const opt: Option = props.data;
    return (
      <div className="flex items-center gap-1 text-xs">
        <span
          className="inline-block rounded-full p-3"
          style={{ width: 8, height: 8, background: opt.meta.dot }}
        />
        <span>{opt.label}</span>
      </div>
    );
  };

  const mergedStyles = {
    ...styles,
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: 38,
      borderRadius: 8,
      backgroundColor: "transparent",
      boxShadow: state.isFocused ? "0 0 0 1px #0ea5e9" : "none",
      borderColor: state.isFocused ? "#0ea5e9" : provided.borderColor,
    }),
  };

  const selectedValue = multiple
    ? options.filter((o) => Array.isArray(value) && value.includes(o.value))
    : options.find((o) => o.value === value) ?? null;

  return (
    <Select
      isMulti={multiple}
      options={options}
      value={selectedValue}
      onChange={(opt: any) => {
        if (multiple) {
          const vals = Array.isArray(opt)
            ? opt.map((o) => o.value)
            : [];
          onChange(vals);
        } else {
          onChange(opt ? opt.value : undefined);
        }
      }}
      isClearable
      styles={mergedStyles}
      theme={theme}
      formatOptionLabel={formatOptionLabel}
      components={multiple ? { MultiValueLabel } : { SingleValue }}
      classNamePrefix="cf-select"
    />
  );
}
