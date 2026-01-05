import Select from "react-select";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";
import type { TeamMember } from "../types";

type Option = {
  value: string;
  label: string;
  member: TeamMember;
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

  const options: Option[] = team.map((t) => ({
    value: String(t.id),
    label: t.name ?? "Unnamed",
    member: t,
  }));

  /* ================= UI PARTS ================= */

  const Avatar = ({ member, size = 20 }: { member: TeamMember; size?: number }) => {
    const initial = member.name?.[0]?.toUpperCase() ?? "?";

    return member.photo ? (
      <img
        src={member.photo}
        alt={member.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className="
          rounded-full bg-gray-300 dark:bg-gray-600
          text-[10px] font-semibold text-gray-700 dark:text-gray-200
          flex items-center justify-center
        "
        style={{ width: size, height: size }}
      >
        {initial}
      </div>
    );
  };

  const formatOptionLabel = (opt: Option) => (
    <div className="flex items-center gap-2 text-sm">
      <Avatar member={opt.member} size={18} />
      <span className="truncate">{opt.label}</span>
    </div>
  );

  const SingleValue = (props: any) => {
    const opt: Option = props.data;
    return (
      <div className="flex items-center gap-2 text-sm">
        <Avatar member={opt.member} size={18} />
        <span className="truncate">{opt.label}</span>
      </div>
    );
  };

  const MultiValueLabel = (props: any) => {
    const opt: Option = props.data;
    return (
      <div className="flex items-center gap-1 text-xs">
        <Avatar member={opt.member} size={14} />
        <span className="truncate">{opt.label}</span>
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
          onChange(Array.isArray(opt) ? opt.map((o) => o.value) : []);
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
