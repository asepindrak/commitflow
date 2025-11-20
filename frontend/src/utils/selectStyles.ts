// frontend/src/utils/selectStyles.ts
export const LIGHT = {
    bg: '#ffffff',
    controlBorder: '#d1d5db',
    controlHover: '#e5e7eb',
    menuBg: '#ffffff',
    optionHover: '#f3f4f6',
    text: '#111827',
    muted: '#6b7280',
    primary: '#0ea5e9'
};

export const DARK = {
    bg: '#0b1220',
    controlBorder: '#374151',
    controlHover: '#1f2937',
    menuBg: '#0b1220',
    optionHover: '#111827',
    text: '#e5e7eb',
    muted: '#9ca3af',
    primary: '#0ea5e9'
};

export function makeSelectStyles(isDark: boolean) {
    const C = isDark ? DARK : LIGHT;
    return {
        control: (provided: any, state: any) => ({
            ...provided,
            background: C.bg,
            borderColor: state.isFocused ? C.primary : C.controlBorder,
            boxShadow: state.isFocused ? `0 0 0 1px ${C.primary}` : 'none',
            '&:hover': { borderColor: C.controlHover },
            color: C.text,
            minHeight: '38px',
            padding: '2px 6px',
        }),
        singleValue: (provided: any) => ({ ...provided, color: C.text }),
        input: (provided: any) => ({ ...provided, color: C.text }),
        placeholder: (provided: any) => ({ ...provided, color: C.muted }),
        menu: (provided: any) => ({ ...provided, background: C.menuBg, marginTop: 4, borderRadius: 8, boxShadow: '0 6px 18px rgba(2,6,23,0.6)', zIndex: 9999 }),
        option: (provided: any, state: any) => ({ ...provided, background: state.isFocused ? C.optionHover : 'transparent', color: C.text, cursor: 'pointer', padding: '8px 12px' }),
        multiValue: (provided: any) => ({ ...provided, background: isDark ? '#14303a' : '#e6f7ff', color: C.text }),
        multiValueLabel: (provided: any) => ({ ...provided, color: C.text }),
        dropdownIndicator: (provided: any) => ({ ...provided, color: C.muted }),
        clearIndicator: (provided: any) => ({ ...provided, color: C.muted }),
        indicatorSeparator: () => ({ display: 'none' }),
    };
}

export function makeSelectTheme(isDark: boolean) {
    const themeFn = (theme: any) => {
        const base = { ...theme, borderRadius: 8 };
        const colors = {
            ...base.colors,
            primary25: isDark ? DARK.optionHover : LIGHT.optionHover,
            primary: isDark ? DARK.primary : LIGHT.primary,
            neutral0: isDark ? DARK.menuBg : LIGHT.menuBg,
            neutral10: isDark ? DARK.controlBorder : LIGHT.controlBorder,
            neutral20: isDark ? DARK.controlBorder : LIGHT.controlBorder,
            neutral30: isDark ? DARK.controlBorder : LIGHT.controlBorder,
            neutral80: isDark ? DARK.text : LIGHT.text,
        };
        return { ...base, colors };
    };
    return themeFn;
}
